import { describe, expect, it } from 'vitest';
import type { EventCallback } from '@tauri-apps/api/event';
import {
  StorageError,
  createTauriFileSystem,
  toBase64,
  createTauriFolderWatcher,
  openAppFolder,
  type TauriBridge,
} from './tauriStorage';

interface Call {
  readonly command: string;
  readonly args: unknown;
  readonly headers: unknown;
}

/** Мост Tauri для тестов: запоминает вызовы, отвечает по таблице, умеет присылать события. */
function fakeBridge(respond: (command: string, args: unknown) => unknown = () => undefined) {
  const calls: Call[] = [];
  const handlers: EventCallback<unknown>[] = [];
  let unlistened = 0;
  const bridge: TauriBridge = {
    invoke: <T>(command: string, args?: unknown, options?: { headers?: unknown }) => {
      calls.push({ command, args, headers: options?.headers });
      try {
        return Promise.resolve(respond(command, args) as T); // ответ таблицы и есть ответ команды
      } catch (error: unknown) {
        return Promise.reject(error instanceof Error ? error : new Error(String(error)));
      }
    },
    listen: <T>(_event: string, handler: EventCallback<T>) => {
      handlers.push(handler as EventCallback<unknown>); // события в тесте приходят того же вида
      return Promise.resolve(() => {
        unlistened += 1;
      });
    },
  };
  const emit = (payload: unknown) => {
    for (const handler of handlers) handler({ event: 'storage://changed', id: 1, payload });
  };
  return { bridge, calls, emit, unlistened: () => unlistened };
}

const ROOT = 'L:\\project\\Моя игра.doska';

describe('файловая система через Tauri', () => {
  it('читает файл: первый байт — признак наличия', async () => {
    const { bridge } = fakeBridge((_command, args) => {
      const { path } = args as { path: string }; // аргументы задаёт сам адаптер
      return path === 'есть.log' ? new Uint8Array([1, 7, 8]).buffer : new Uint8Array([0]).buffer;
    });
    const fs = createTauriFileSystem(ROOT, bridge);
    expect(await fs.readFile('есть.log')).toEqual(new Uint8Array([7, 8]));
    expect(await fs.readFile('нет.log')).toBeNull();
  });

  it('пустой существующий файл — пустые данные, а не null', async () => {
    const { bridge } = fakeBridge(() => new Uint8Array([1]).buffer);
    expect(await createTauriFileSystem(ROOT, bridge).readFile('a')).toEqual(new Uint8Array());
  });

  it('пишет бинарные данные без JSON, путь — в закодированных заголовках', async () => {
    const { bridge, calls } = fakeBridge();
    const data = new Uint8Array([1, 2, 3]);
    await createTauriFileSystem(ROOT, bridge).writeFileAtomic('data/pc/доска.snapshot', data);
    expect(calls).toEqual([
      {
        command: 'storage_write_atomic',
        args: data,
        headers: {
          'x-doska-root': encodeURIComponent(ROOT),
          'x-doska-path': encodeURIComponent('data/pc/доска.snapshot'),
        },
      },
    ]);
  });

  it('на Android пишет данные в base64 внутри JSON', async () => {
    const { bridge, calls } = fakeBridge();
    const data = new Uint8Array([1, 2, 3, 250]);
    await createTauriFileSystem(ROOT, bridge, true).appendFile('data/pc/доска.log', data);
    expect(calls[0]?.args).toEqual({ base64: 'AQID+g==' });
  });

  it('base64 больших данных совпадает с побайтовым', () => {
    const data = Uint8Array.from({ length: 70_000 }, (_, index) => (index * 7) % 256);
    const expected = btoa(Array.from(data, (byte) => String.fromCharCode(byte)).join(''));
    expect(toBase64(data)).toBe(expected);
  });

  it('ошибка Rust превращается в StorageError с кодом', async () => {
    const { bridge } = fakeBridge(() => {
      throw new Error('INVALID_PATH: недопустимый путь');
    });
    const fs = createTauriFileSystem(ROOT, bridge);
    await expect(fs.listDir('../x')).rejects.toBeInstanceOf(StorageError);
    await expect(fs.listDir('../x')).rejects.toThrow('storage_list');
  });
});

describe('служебные папки и дата изменения', () => {
  it('открывает папку приложения по виду и спрашивает дату изменения папки', async () => {
    const { bridge, calls } = fakeBridge((command) =>
      command === 'storage_open_app_folder' ? 'C:/Users/me/Documents/Доска' : 1700,
    );
    expect(await openAppFolder('projects', bridge)).toBe('C:/Users/me/Documents/Доска');
    expect(await createTauriFileSystem(ROOT, bridge).latestChange('Игра.doska')).toBe(1700);
    expect(calls.map((call) => [call.command, call.args])).toEqual([
      ['storage_open_app_folder', { kind: 'projects' }],
      ['storage_latest_change', { root: ROOT, path: 'Игра.doska' }],
    ]);
  });
});

describe('слежение через Tauri', () => {
  it('передаёт только изменения своей папки и своего проекта', async () => {
    const { bridge, calls, emit } = fakeBridge();
    const seen: (readonly string[])[] = [];
    createTauriFolderWatcher(ROOT, bridge).watch('data', (paths) => seen.push(paths));
    await Promise.resolve();

    emit({ root: ROOT, paths: ['data/phone/b.log', 'assets/x.png'] });
    emit({ root: 'другой проект', paths: ['data/phone/b.log'] });
    emit({ root: ROOT, paths: ['assets/y.png'] });

    expect(seen).toEqual([['data/phone/b.log']]);
    expect(calls.map((call) => call.command)).toContain('storage_watch');
  });

  it('после отписки события не приходят, подписка Tauri снимается', async () => {
    const { bridge, emit, unlistened } = fakeBridge();
    const seen: unknown[] = [];
    const stop = createTauriFolderWatcher(ROOT, bridge).watch('', (paths) => seen.push(paths));
    await Promise.resolve();
    stop();
    emit({ root: ROOT, paths: ['data/a.log'] });
    expect(seen).toEqual([]);
    expect(unlistened()).toBe(1);
  });

  it('отписка до установки подписки тоже снимает её', async () => {
    const { bridge, unlistened } = fakeBridge();
    const stop = createTauriFolderWatcher(ROOT, bridge).watch('', () => undefined);
    stop();
    await Promise.resolve();
    await Promise.resolve();
    expect(unlistened()).toBe(1);
  });
});
