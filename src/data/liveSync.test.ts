import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createManualClock,
  createManualFolderWatcher,
  createMemoryFileSystem,
  createSequentialIdGenerator,
  type BoardId,
  type MemoryFileSystem,
} from '../core';
import type { RefreshReport } from './documentStore';
import { startLiveSync } from './liveSync';
import { createProject, openProject, type ProjectContext } from './project';
import { insertBoard, readBoards } from './projectDocument';

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

/** Обновление, которое можно держать «в процессе», чтобы проверить очередь. */
function controllableRefresh() {
  let calls = 0;
  let release: (() => void) | null = null;
  const refresh = (): Promise<RefreshReport[]> => {
    calls += 1;
    return new Promise((resolve) => {
      release = () => {
        resolve([]);
      };
    });
  };
  return {
    refresh,
    calls: () => calls,
    finish: () => {
      release?.();
      release = null;
    },
  };
}

describe('живое слияние', () => {
  it('пачка событий от Syncthing — одно перечитывание после паузы', async () => {
    const watcher = createManualFolderWatcher();
    const refresh = vi.fn(() => Promise.resolve<RefreshReport[]>([]));
    startLiveSync(refresh, { watcher, debounceMs: 300 });
    watcher.emit(['data/phone/a.log']);
    await vi.advanceTimersByTimeAsync(100);
    watcher.emit(['data/phone/a.snapshot']);
    await vi.advanceTimersByTimeAsync(299);
    expect(refresh).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('изменения вне data/ не вызывают перечитывания', async () => {
    const watcher = createManualFolderWatcher();
    const refresh = vi.fn(() => Promise.resolve<RefreshReport[]>([]));
    startLiveSync(refresh, { watcher });
    watcher.emit(['assets/картинка.png', '.stignore']);
    await vi.advanceTimersByTimeAsync(1000);
    expect(refresh).not.toHaveBeenCalled();
  });

  it('перечитывания не идут параллельно; событие во время перечитывания даёт ещё одно', async () => {
    const watcher = createManualFolderWatcher();
    const control = controllableRefresh();
    startLiveSync(control.refresh, { watcher, debounceMs: 10 });
    watcher.emit(['data/phone/a.log']);
    await vi.advanceTimersByTimeAsync(10);
    expect(control.calls()).toBe(1);

    watcher.emit(['data/phone/a.log']);
    await vi.advanceTimersByTimeAsync(10);
    watcher.emit(['data/phone/b.log']);
    await vi.advanceTimersByTimeAsync(10);
    expect(control.calls()).toBe(1);

    control.finish();
    await vi.advanceTimersByTimeAsync(0);
    expect(control.calls()).toBe(2);
    control.finish();
    await vi.advanceTimersByTimeAsync(0);
    expect(control.calls()).toBe(2);
  });

  it('опрос по таймеру для телефона и остановка', async () => {
    const refresh = vi.fn(() => Promise.resolve<RefreshReport[]>([]));
    const sync = startLiveSync(refresh, { pollMs: 5000 });
    await vi.advanceTimersByTimeAsync(10_000);
    expect(refresh).toHaveBeenCalledTimes(2);
    sync.stop();
    await vi.advanceTimersByTimeAsync(10_000);
    expect(refresh).toHaveBeenCalledTimes(2);
  });

  it('ошибка перечитывания сообщается и не останавливает слежение', async () => {
    const watcher = createManualFolderWatcher();
    const errors: unknown[] = [];
    let fail = true;
    const refresh = vi.fn(() =>
      fail ? Promise.reject(new Error('диск')) : Promise.resolve<RefreshReport[]>([]),
    );
    startLiveSync(refresh, { watcher, debounceMs: 1, onError: (error) => errors.push(error) });
    watcher.emit(['data/x']);
    await vi.advanceTimersByTimeAsync(1);
    fail = false;
    watcher.emit(['data/x']);
    await vi.advanceTimersByTimeAsync(1);
    expect(errors).toHaveLength(1);
    expect(refresh).toHaveBeenCalledTimes(2);
  });
});

describe('живое слияние с проектом', () => {
  function context(fs: MemoryFileSystem, deviceId: string): ProjectContext {
    return {
      fs,
      deviceId,
      clock: createManualClock(0),
      ids: createSequentialIdGenerator(deviceId),
    };
  }

  it('доска, созданная на телефоне, появляется на ПК без перезапуска', async () => {
    const pcFs = createMemoryFileSystem();
    const phoneFs = createMemoryFileSystem();
    const created = await createProject(context(pcFs, 'pc'), 'Игра');
    if (!created.ok) throw new Error(created.error);
    const pc = created.value;
    for (const [path, data] of pcFs.snapshot()) phoneFs.putExternal(path, data);

    const watcher = createManualFolderWatcher();
    startLiveSync(pc.refreshAll, { watcher, debounceMs: 50 });

    const opened = await openProject(context(phoneFs, 'phone'));
    if (!opened.ok) throw new Error(opened.error);
    insertBoard(opened.value.projectDoc.doc, {
      id: 'board-phone' as BoardId, // заведомо корректный id
      title: 'С телефона',
      parentId: pc.meta.rootBoardId,
      icon: null,
      color: 'default',
      background: 'plain',
      createdAt: 0,
      updatedAt: 0,
      deletedAt: null,
    });
    await opened.value.flushAll();

    // Syncthing привозит файлы телефона на ПК, ОС сообщает только о новой папке.
    for (const [path, data] of phoneFs.snapshot()) {
      if (path.startsWith('data/phone/')) pcFs.putExternal(path, data);
    }
    watcher.emit(['data/phone']);
    await vi.advanceTimersByTimeAsync(50);

    expect(readBoards(pc.projectDoc.doc).items.map((board) => board.title)).toContain('С телефона');
  });
});
