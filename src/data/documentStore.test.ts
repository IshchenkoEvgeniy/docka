import { afterEach, describe, expect, it, vi } from 'vitest';
import * as Y from 'yjs';
import { createMemoryFileSystem, type MemoryFileSystem } from '../core';
import { openDocument } from './documentStore';
import { encodeFrame } from './logFormat';

const BOARD = 'board-1';

/** Имитация Syncthing: копирует папку устройства from → to (её пишет только её владелец). */
function syncDeviceFolder(from: MemoryFileSystem, to: MemoryFileSystem, deviceId: string): void {
  for (const [path, data] of from.snapshot()) {
    if (path.startsWith(`data/${deviceId}/`)) to.putExternal(path, data);
  }
}

function syncBoth(pc: MemoryFileSystem, phone: MemoryFileSystem): void {
  syncDeviceFolder(pc, phone, 'pc');
  syncDeviceFolder(phone, pc, 'phone');
}

function addCard(doc: Y.Doc, id: string, title: string): void {
  doc.transact(() => {
    const card = new Y.Map<unknown>();
    card.set('title', new Y.Text(title));
    card.set('x', 0);
    doc.getMap<Y.Map<unknown>>('cards').set(id, card);
  });
}

function cardTitle(doc: Y.Doc, id: string): string | undefined {
  const title = doc.getMap<Y.Map<unknown>>('cards').get(id)?.get('title');
  return title instanceof Y.Text ? title.toJSON() : undefined;
}

function editTitle(doc: Y.Doc, id: string, edit: (text: Y.Text) => void): void {
  const title = doc.getMap<Y.Map<unknown>>('cards').get(id)?.get('title');
  if (!(title instanceof Y.Text)) throw new Error(`нет карточки ${id}`);
  edit(title);
}

const cardIds = (doc: Y.Doc) => [...doc.getMap('cards').keys()].sort();

describe('два устройства правят офлайн', () => {
  it('после синхронизации у обоих одинаковое состояние без потерь', async () => {
    const pcFs = createMemoryFileSystem();
    const phoneFs = createMemoryFileSystem();

    // Общая карточка, созданная на ПК и уже доехавшая до телефона.
    const pc = await openDocument({ fs: pcFs, deviceId: 'pc' }, BOARD);
    addCard(pc.doc, 'shared', 'Таверна');
    await pc.flush();
    syncBoth(pcFs, phoneFs);
    const phone = await openDocument({ fs: phoneFs, deviceId: 'phone' }, BOARD);
    expect(cardTitle(phone.doc, 'shared')).toBe('Таверна');

    // Связи нет: оба правят одну и ту же карточку и добавляют свои.
    addCard(pc.doc, 'npc', 'Трактирщик');
    editTitle(pc.doc, 'shared', (text) => {
      text.insert(0, 'Старая ');
    });
    addCard(phone.doc, 'item', 'Кружка');
    editTitle(phone.doc, 'shared', (text) => {
      text.insert(text.length, ' у реки');
    });
    await pc.flush();
    await phone.flush();

    syncBoth(pcFs, phoneFs);
    await pc.refresh();
    await phone.refresh();

    expect(cardIds(pc.doc)).toEqual(['item', 'npc', 'shared']);
    expect(cardTitle(pc.doc, 'shared')).toBe('Старая Таверна у реки');
    expect(Y.encodeStateAsUpdate(pc.doc)).toEqual(Y.encodeStateAsUpdate(phone.doc));
  });

  it('каждое устройство пишет только в свою папку', async () => {
    const fs = createMemoryFileSystem();
    const pc = await openDocument({ fs, deviceId: 'pc' }, BOARD);
    addCard(pc.doc, 'a', 'A');
    await pc.flush();
    await pc.compact();
    expect(fs.writtenPaths().every((path) => path.startsWith('data/pc/'))).toBe(true);
  });

  it('правки, полученные от другого устройства, не дублируются в свой журнал', async () => {
    const pcFs = createMemoryFileSystem();
    const phoneFs = createMemoryFileSystem();
    const pc = await openDocument({ fs: pcFs, deviceId: 'pc' }, BOARD);
    addCard(pc.doc, 'a', 'A');
    await pc.flush();
    syncBoth(pcFs, phoneFs);
    const phone = await openDocument({ fs: phoneFs, deviceId: 'phone' }, BOARD);
    await phone.refresh();
    await phone.flush();
    expect(phoneFs.writtenPaths()).toEqual([]);
  });
});

describe('журнал и снимок', () => {
  it('документ восстанавливается из своих файлов после перезапуска', async () => {
    const fs = createMemoryFileSystem();
    const first = await openDocument({ fs, deviceId: 'pc' }, BOARD);
    addCard(first.doc, 'a', 'Первая');
    await first.flush();
    addCard(first.doc, 'b', 'Вторая');
    await first.flush();
    first.close();

    const reopened = await openDocument({ fs, deviceId: 'pc' }, BOARD);
    expect(cardIds(reopened.doc)).toEqual(['a', 'b']);
  });

  it('сжатие переносит всё в снимок и очищает журнал', async () => {
    const fs = createMemoryFileSystem();
    const pc = await openDocument({ fs, deviceId: 'pc' }, BOARD);
    for (let i = 0; i < 20; i += 1) {
      addCard(pc.doc, `c${String(i)}`, `Карточка ${String(i)}`);
      await pc.flush();
    }
    await pc.compact();
    expect(fs.snapshot().get('data/pc/board-1.log')?.length).toBe(0);

    const reopened = await openDocument({ fs, deviceId: 'pc' }, BOARD);
    expect(cardIds(reopened.doc)).toHaveLength(20);
  });

  it('журнал сжимается сам, когда превышает порог', async () => {
    const fs = createMemoryFileSystem();
    const pc = await openDocument({ fs, deviceId: 'pc', compactThresholdBytes: 500 }, BOARD);
    for (let i = 0; i < 30; i += 1) {
      addCard(pc.doc, `c${String(i)}`, 'текст карточки');
      await pc.flush();
    }
    expect(fs.snapshot().get('data/pc/board-1.snapshot')).toBeDefined();
    expect(fs.snapshot().get('data/pc/board-1.log')?.length ?? 0).toBeLessThan(500);
  });

  it('устройство, пропустившее правки, получает их из снимка после сжатия у другого', async () => {
    const pcFs = createMemoryFileSystem();
    const phoneFs = createMemoryFileSystem();
    const pc = await openDocument({ fs: pcFs, deviceId: 'pc' }, BOARD);
    const phone = await openDocument({ fs: phoneFs, deviceId: 'phone' }, BOARD);
    addCard(pc.doc, 'a', 'A');
    await pc.flush();
    addCard(pc.doc, 'b', 'B');
    await pc.flush();
    await pc.compact(); // журнал ПК пуст, всё в снимке, телефон ещё ничего не видел
    syncBoth(pcFs, phoneFs);
    await phone.refresh();
    expect(cardIds(phone.doc)).toEqual(['a', 'b']);
  });
});

describe('повреждённые данные', () => {
  it('оборванная запись в чужом журнале не ломает доску: целые правки применяются', async () => {
    const pcFs = createMemoryFileSystem();
    const phoneFs = createMemoryFileSystem();
    const pc = await openDocument({ fs: pcFs, deviceId: 'pc' }, BOARD);
    addCard(pc.doc, 'a', 'A');
    await pc.flush();
    syncBoth(pcFs, phoneFs);
    const log = phoneFs.snapshot().get('data/pc/board-1.log') ?? new Uint8Array();
    phoneFs.putExternal('data/pc/board-1.log', new Uint8Array([...log, 5, 0, 0, 0, 1]));

    const phone = await openDocument({ fs: phoneFs, deviceId: 'phone' }, BOARD);
    const report = await phone.refresh();
    expect(cardIds(phone.doc)).toEqual(['a']);
    expect(report.corruptFiles).toEqual(['data/pc/board-1.log']);
  });

  it('кадр с неверными данными Yjs пропускается, остальное применяется', async () => {
    const fs = createMemoryFileSystem();
    const other = new Y.Doc();
    addCard(other, 'ok', 'Целая');
    fs.putExternal(
      'data/phone/board-1.log',
      new Uint8Array([
        ...encodeFrame(new Uint8Array([1, 2, 3])),
        ...encodeFrame(Y.encodeStateAsUpdate(other)),
      ]),
    );
    const pc = await openDocument({ fs, deviceId: 'pc' }, BOARD);
    expect(cardIds(pc.doc)).toEqual(['ok']);
  });

  it('свой журнал с оборванным хвостом сразу сжимается, новые правки не теряются', async () => {
    const fs = createMemoryFileSystem();
    const first = await openDocument({ fs, deviceId: 'pc' }, BOARD);
    addCard(first.doc, 'a', 'A');
    await first.flush();
    first.close();
    const log = fs.snapshot().get('data/pc/board-1.log') ?? new Uint8Array();
    fs.putExternal('data/pc/board-1.log', log.subarray(0, log.length - 3));
    fs.putExternal('data/pc/board-1.snapshot', encodeFrame(Y.encodeStateAsUpdate(new Y.Doc())));

    const reopened = await openDocument({ fs, deviceId: 'pc' }, BOARD);
    addCard(reopened.doc, 'b', 'B');
    await reopened.flush();
    const again = await openDocument({ fs, deviceId: 'pc' }, BOARD);
    expect(cardIds(again.doc)).toEqual(['b']);
  });

  it('недопустимый идентификатор устройства отклоняется', async () => {
    const fs = createMemoryFileSystem();
    await expect(openDocument({ fs, deviceId: '../hack' }, BOARD)).rejects.toThrow();
  });
});

describe('автосохранение', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('записывает журнал через паузу после последней правки, одной записью', async () => {
    vi.useFakeTimers();
    const fs = createMemoryFileSystem();
    const pc = await openDocument({ fs, deviceId: 'pc', autoFlushMs: 1000 }, BOARD);
    addCard(pc.doc, 'a', 'A');
    await vi.advanceTimersByTimeAsync(600);
    addCard(pc.doc, 'b', 'B');
    await vi.advanceTimersByTimeAsync(600);
    expect(fs.writtenPaths()).toEqual([]);
    await vi.advanceTimersByTimeAsync(500);
    expect(fs.writtenPaths()).toEqual(['data/pc/board-1.log']);

    const reopened = await openDocument({ fs, deviceId: 'pc' }, BOARD);
    expect(cardIds(reopened.doc)).toEqual(['a', 'b']);
  });

  it('правки с диска не запускают автосохранение, после close таймер не срабатывает', async () => {
    vi.useFakeTimers();
    const fs = createMemoryFileSystem();
    const other = new Y.Doc();
    addCard(other, 'x', 'X');
    fs.putExternal('data/phone/board-1.log', encodeFrame(Y.encodeStateAsUpdate(other)));
    const pc = await openDocument({ fs, deviceId: 'pc', autoFlushMs: 100 }, BOARD);
    await pc.refresh();
    addCard(pc.doc, 'a', 'A');
    pc.close();
    await vi.advanceTimersByTimeAsync(1000);
    expect(fs.writtenPaths()).toEqual([]);
  });
});
