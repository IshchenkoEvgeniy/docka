import { describe, expect, it, vi } from 'vitest';
import * as Y from 'yjs';
import {
  FORMAT_VERSION,
  createManualClock,
  createMemoryFileSystem,
  createSequentialIdGenerator,
  type BoardId,
  type MemoryFileSystem,
} from '../core';
import { executeBoardCommand, executeProjectCommand } from './commands';
import {
  MIGRATIONS,
  checkMigrationChain,
  documentFormatVersion,
  type Migration,
} from './migrations';
import { createProject, openProject, type ProjectContext } from './project';
import { readBoards, readElements, readEntityTypes } from './projectDocument';

/** Тестовые миграции «будущих» версий 2 и 3: помечают элементы досок и документ проекта. */
function futureMigrations() {
  const markElements = (flag: string) => (doc: Y.Doc) => {
    doc.getMap<unknown>('elements').forEach((record) => {
      const data = record instanceof Y.Map ? (record as Y.Map<unknown>).get('data') : undefined; // записи — Y.Map
      if (data instanceof Y.Map) data.set(flag, true);
    });
  };
  const v2: Migration = {
    version: 2,
    description: 'тест: отметка v2',
    migrateProjectDoc: vi.fn((doc: Y.Doc) => {
      doc.getMap<unknown>('meta').set('v2', true);
    }),
    migrateBoardDoc: vi.fn(markElements('v2')),
  };
  const v3: Migration = {
    version: 3,
    description: 'тест: отметка v3',
    migrateBoardDoc: vi.fn(markElements('v3')),
  };
  return { v2, v3, format: { version: 3, migrations: [v2, v3] } };
}

function context(
  fs: MemoryFileSystem,
  deviceId = 'pc',
  format?: ProjectContext['format'],
): ProjectContext {
  return {
    fs,
    deviceId,
    clock: createManualClock(0),
    ids: createSequentialIdGenerator(deviceId),
    ...(format ? { format } : {}),
  };
}

const FORMAT_1 = { version: 1, migrations: [] };

/** Проект формата 1 с доской и одним элементом на ней. */
async function oldProject(fs: MemoryFileSystem) {
  const ctx = context(fs, 'pc', FORMAT_1);
  const created = await createProject(ctx, 'Игра');
  if (!created.ok) throw new Error(created.error);
  const project = created.value;
  const board = executeProjectCommand(
    project.projectDoc.doc,
    { kind: 'createBoard', parentId: project.meta.rootBoardId, title: 'НПС' },
    ctx,
  );
  const boardId = (board.ok ? board.value.createdId : '') as BoardId; // доска создана выше
  const stored = await project.openBoard(boardId);
  executeBoardCommand(
    stored.doc,
    boardId,
    {
      kind: 'createElement',
      type: 'note',
      placement: { x: 0, y: 0, width: 1, height: 1 },
      data: { text: 'Трактирщик' },
    },
    ctx,
  );
  await project.close();
  return boardId;
}

const projectJson = (fs: MemoryFileSystem) =>
  JSON.parse(new TextDecoder().decode(fs.snapshot().get('project.json'))) as {
    formatVersion: number;
  };

describe('цепочка миграций', () => {
  const step = (version: number): Migration => ({ version, description: '' });
  it('должна быть непрерывной и без лишних шагов', () => {
    expect(checkMigrationChain([], 1).ok).toBe(true);
    expect(checkMigrationChain([step(2), step(3)], 3).ok).toBe(true);
    expect(checkMigrationChain([step(3)], 3).ok).toBe(false);
    expect(checkMigrationChain([step(2), step(2)], 2).ok).toBe(false);
    expect(checkMigrationChain([step(2), step(4)], 2).ok).toBe(false);
  });
});

describe('миграция проекта', () => {
  it('project.json и документ проекта — при открытии, доски — при открытии доски', async () => {
    const fs = createMemoryFileSystem();
    const boardId = await oldProject(fs);
    const { v2, v3, format } = futureMigrations();

    const opened = await openProject(context(fs, 'pc', format));
    if (!opened.ok) throw new Error(opened.error);
    expect(projectJson(fs).formatVersion).toBe(3);
    expect(documentFormatVersion(opened.value.projectDoc.doc)).toBe(3);
    expect(opened.value.projectDoc.doc.getMap('meta').get('v2')).toBe(true);
    expect(v2.migrateBoardDoc).not.toHaveBeenCalled();

    const board = await opened.value.openBoard(boardId);
    expect(readElements(board.doc).items[0]?.data).toEqual({
      text: 'Трактирщик',
      v2: true,
      v3: true,
    });
    expect(v3.migrateBoardDoc).toHaveBeenCalledTimes(1);
    await opened.value.close();

    const again = await openProject(context(fs, 'pc', format));
    if (!again.ok) throw new Error(again.error);
    await again.value.openBoard(boardId);
    expect(v2.migrateProjectDoc).toHaveBeenCalledTimes(1);
    expect(v3.migrateBoardDoc).toHaveBeenCalledTimes(1);
  });

  it('старое приложение не открывает и не меняет обновлённый проект', async () => {
    const fs = createMemoryFileSystem();
    await oldProject(fs);
    const newer = {
      version: FORMAT_VERSION + 1,
      migrations: [...MIGRATIONS, { version: FORMAT_VERSION + 1, description: 'тест' }],
    };
    const upgraded = await openProject(context(fs, 'pc', newer));
    if (!upgraded.ok) throw new Error(upgraded.error);
    await upgraded.value.close();
    const writes = fs.writtenPaths().length;
    expect(await openProject(context(fs))).toMatchObject({
      ok: false,
      error: expect.stringContaining('обновите') as unknown,
    });
    expect(fs.writtenPaths().length).toBe(writes);
  });

  it('доска, обновлённая другим устройством раньше project.json, не открывается старым приложением', async () => {
    const fs = createMemoryFileSystem();
    const boardId = await oldProject(fs);
    const project = await openProject(context(fs));
    if (!project.ok) throw new Error(project.error);
    const newer = new Y.Doc();
    newer.getMap<unknown>('format').set('v9', true);
    const { encodeFrame } = await import('./logFormat');
    fs.putExternal(`data/phone/${boardId}.log`, encodeFrame(Y.encodeStateAsUpdate(newer)));
    await expect(project.value.openBoard(boardId)).rejects.toThrow('новой версией');
  });

  it('два устройства обновляют проект одновременно — результат одинаковый', async () => {
    const pcFs = createMemoryFileSystem();
    const boardId = await oldProject(pcFs);
    const phoneFs = createMemoryFileSystem();
    for (const [path, data] of pcFs.snapshot()) phoneFs.putExternal(path, data);

    const migrate = async (fs: MemoryFileSystem, device: string) => {
      const opened = await openProject(context(fs, device, futureMigrations().format));
      if (!opened.ok) throw new Error(opened.error);
      await opened.value.openBoard(boardId);
      await opened.value.flushAll();
      return opened.value;
    };
    const pc = await migrate(pcFs, 'pc');
    const phone = await migrate(phoneFs, 'phone');
    for (const [path, data] of phoneFs.snapshot())
      if (path.startsWith('data/phone/')) pcFs.putExternal(path, data);
    for (const [path, data] of pcFs.snapshot())
      if (path.startsWith('data/pc/')) phoneFs.putExternal(path, data);
    await pc.refreshAll();
    await phone.refreshAll();
    const state = async (project: typeof pc) =>
      readElements((await project.openBoard(boardId)).doc).items.map((e) => e.data);
    expect(await state(pc)).toEqual(await state(phone));
    expect(await state(pc)).toEqual([{ text: 'Трактирщик', v2: true, v3: true }]);
  });

  it('формат 2: встроенные типы сущностей, одинаковые после одновременной миграции', async () => {
    const pcFs = createMemoryFileSystem();
    await oldProject(pcFs);
    const phoneFs = createMemoryFileSystem();
    for (const [path, data] of pcFs.snapshot()) phoneFs.putExternal(path, data);
    const open = async (fs: MemoryFileSystem, device: string) => {
      const opened = await openProject(context(fs, device));
      if (!opened.ok) throw new Error(opened.error);
      await opened.value.flushAll();
      return opened.value;
    };
    const pc = await open(pcFs, 'pc');
    const phone = await open(phoneFs, 'phone');
    for (const [path, data] of phoneFs.snapshot())
      if (path.startsWith('data/phone/')) pcFs.putExternal(path, data);
    await pc.refreshAll();
    const types = readEntityTypes(pc.projectDoc.doc);
    expect(types.invalid).toEqual([]);
    expect(types.items.map((type) => type.builtin).sort()).toEqual(['item', 'location', 'npc']);
    expect(readEntityTypes(phone.projectDoc.doc).items).toEqual(
      expect.arrayContaining(types.items),
    );
    expect(projectJson(pcFs).formatVersion).toBe(FORMAT_VERSION);
  });

  it('формат 3: теги элементов — множество вместо массива, у досок — пустое множество', async () => {
    const fs = createMemoryFileSystem();
    const boardId = await oldProject(fs);
    const before = await openProject(context(fs, 'pc', FORMAT_1));
    if (!before.ok) throw new Error(before.error);
    const old = await before.value.openBoard(boardId);
    old.doc.transact(() => {
      old.doc.getMap('elements').forEach((record) => {
        const map = record as Y.Map<unknown>; // запись создана выше
        map.delete('tags');
        map.set('tagIds', ['tag-npc-01', 'tag-npc-01']);
      });
    });
    await before.value.close();
    const opened = await openProject(context(fs));
    if (!opened.ok) throw new Error(opened.error);
    const board = await opened.value.openBoard(boardId);
    expect(readElements(board.doc).items[0]?.tags).toEqual({ 'tag-npc-01': true });
    expect(readBoards(opened.value.projectDoc.doc).invalid).toEqual([]);
  });

  it('формат 4: старая доска открывается без изменений карточек, поле tree появляется только по команде', async () => {
    const fs = createMemoryFileSystem();
    const boardId = await oldProject(fs);
    const opened = await openProject(context(fs));
    if (!opened.ok) throw new Error(opened.error);
    const board = await opened.value.openBoard(boardId);
    const elements = readElements(board.doc);
    expect(elements.invalid).toEqual([]);
    expect(elements.items[0]?.tree).toBeUndefined();
    expect(documentFormatVersion(board.doc)).toBe(4);
    expect(projectJson(fs).formatVersion).toBe(4);
  });

  it('версия документа при слиянии только растёт', () => {
    const pc = new Y.Doc();
    const phone = new Y.Doc();
    pc.getMap<unknown>('format').set('v1', true);
    phone.getMap<unknown>('format').set('v3', true);
    Y.applyUpdate(pc, Y.encodeStateAsUpdate(phone));
    Y.applyUpdate(phone, Y.encodeStateAsUpdate(pc));
    expect(documentFormatVersion(pc)).toBe(3);
    expect(documentFormatVersion(phone)).toBe(3);
  });

  it('разорванная цепочка миграций — ошибка до любых изменений', async () => {
    const fs = createMemoryFileSystem();
    await oldProject(fs);
    const writes = fs.writtenPaths().length;
    const broken = { version: 3, migrations: [{ version: 3, description: '' }] };
    expect((await openProject(context(fs, 'pc', broken))).ok).toBe(false);
    expect(fs.writtenPaths().length).toBe(writes);
  });
});
