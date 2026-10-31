import { describe, expect, it } from 'vitest';
import {
  FORMAT_VERSION,
  createManualClock,
  createMemoryFileSystem,
  createSequentialIdGenerator,
  type BoardId,
  type MemoryFileSystem,
} from '../core';
import { createProject, openProject, type OpenProject, type ProjectContext } from './project';
import {
  insertBoard,
  readBoards,
  readElements,
  readProjectName,
  writeProjectName,
} from './projectDocument';
import { createRecord } from './yjsRecords';

function context(fs: MemoryFileSystem, deviceId: string, prefix = deviceId): ProjectContext {
  return { fs, deviceId, clock: createManualClock(1000), ids: createSequentialIdGenerator(prefix) };
}

function unwrap<T>(result: { ok: true; value: T } | { ok: false; error: string }): T {
  if (!result.ok) throw new Error(result.error);
  return result.value;
}

const text = (fs: MemoryFileSystem, path: string) =>
  new TextDecoder().decode(fs.snapshot().get(path));

function sync(from: MemoryFileSystem, to: MemoryFileSystem, deviceId: string): void {
  for (const [path, data] of from.snapshot()) {
    if (path === 'project.json' || path.startsWith(`data/${deviceId}/`)) to.putExternal(path, data);
  }
}

function addChildBoard(project: OpenProject, id: string, title: string): BoardId {
  const boardId = id as BoardId; // id в тестах заведомо корректные
  insertBoard(project.projectDoc.doc, {
    id: boardId,
    title,
    parentId: project.meta.rootBoardId,
    icon: null,
    color: 'default',
    background: 'plain',
    tags: {},
    createdAt: 1,
    updatedAt: 1,
    deletedAt: null,
  });
  return boardId;
}

describe('создание проекта', () => {
  it('пишет project.json, корневую доску и .stignore', async () => {
    const fs = createMemoryFileSystem();
    const project = unwrap(await createProject(context(fs, 'pc'), 'Моя игра'));
    expect(JSON.parse(text(fs, 'project.json'))).toMatchObject({
      formatVersion: FORMAT_VERSION,
      name: 'Моя игра',
    });
    expect(text(fs, '.stignore')).toBe('*.doska-tmp\n');
    const boards = readBoards(project.projectDoc.doc).items;
    expect(boards).toHaveLength(1);
    expect(boards[0]).toMatchObject({
      id: project.meta.rootBoardId,
      title: 'Моя игра',
      parentId: null,
    });
  });

  it('не создаёт проект поверх существующего', async () => {
    const fs = createMemoryFileSystem();
    await createProject(context(fs, 'pc'), 'Первый');
    expect(await createProject(context(fs, 'pc'), 'Второй')).toEqual({
      ok: false,
      error: 'В этой папке уже есть проект',
    });
  });

  it('отклоняет пустое название', async () => {
    expect((await createProject(context(createMemoryFileSystem(), 'pc'), '   ')).ok).toBe(false);
  });
});

describe('открытие проекта', () => {
  it('после перезапуска всё на месте', async () => {
    const fs = createMemoryFileSystem();
    const created = unwrap(await createProject(context(fs, 'pc'), 'Игра'));
    addChildBoard(created, 'board-npc', 'НПС');
    writeProjectName(created.projectDoc.doc, 'Игра про таверну');
    await created.close();

    const reopened = unwrap(await openProject(context(fs, 'pc')));
    expect(
      readBoards(reopened.projectDoc.doc)
        .items.map((board) => board.title)
        .sort(),
    ).toEqual(['Игра', 'НПС']);
    expect(readProjectName(reopened.projectDoc.doc, reopened.meta.name)).toBe('Игра про таверну');
  });

  it('доски загружаются только при открытии', async () => {
    const fs = createMemoryFileSystem();
    const created = unwrap(await createProject(context(fs, 'pc'), 'Игра'));
    const npc = addChildBoard(created, 'board-npc', 'НПС');
    const board = await created.openBoard(npc);
    board.doc.getMap('elements').set('el-1', createRecord({ id: 'el-1' }));
    await created.close();

    const fresh = createMemoryFileSystem();
    for (const [path, data] of fs.snapshot()) fresh.putExternal(path, data);
    const reopened = unwrap(await openProject(context(fresh, 'pc')));
    expect(fresh.readPaths().some((path) => path.includes('board-npc'))).toBe(false);
    await reopened.openBoard(npc);
    expect(fresh.readPaths().some((path) => path.includes('board-npc'))).toBe(true);
    expect(await reopened.openBoard(npc)).toBe(await reopened.openBoard(npc));
  });

  it('понятные ошибки вместо падения', async () => {
    const fs = createMemoryFileSystem();
    expect(await openProject(context(fs, 'pc'))).toMatchObject({
      ok: false,
      error: expect.stringContaining('нет проекта') as unknown,
    });
    fs.putExternal('project.json', new TextEncoder().encode('{не json'));
    expect(await openProject(context(fs, 'pc'))).toMatchObject({
      ok: false,
      error: expect.stringContaining('не JSON') as unknown,
    });
    fs.putExternal('project.json', new TextEncoder().encode('{"formatVersion": 1}'));
    expect(await openProject(context(fs, 'pc'))).toMatchObject({
      ok: false,
      error: expect.stringContaining('повреждён') as unknown,
    });
  });

  it('проект из более новой версии приложения не открывается и не портится', async () => {
    const fs = createMemoryFileSystem();
    unwrap(await createProject(context(fs, 'pc'), 'Игра'));
    const meta = JSON.parse(text(fs, 'project.json')) as Record<string, unknown>; // записан createProject
    fs.putExternal(
      'project.json',
      new TextEncoder().encode(JSON.stringify({ ...meta, formatVersion: 99 })),
    );
    const before = fs.writtenPaths().length;
    expect(await openProject(context(fs, 'pc'))).toMatchObject({
      ok: false,
      error: expect.stringContaining('обновите') as unknown,
    });
    expect(fs.writtenPaths().length).toBe(before);
  });

  it('.stignore пользователя сохраняется, нужная строка добавляется один раз', async () => {
    const fs = createMemoryFileSystem();
    unwrap(await createProject(context(fs, 'pc'), 'Игра'));
    fs.putExternal('.stignore', new TextEncoder().encode('// мои правила\n*.psd'));
    await unwrap(await openProject(context(fs, 'pc'))).close();
    await unwrap(await openProject(context(fs, 'pc'))).close();
    expect(text(fs, '.stignore')).toBe('// мои правила\n*.psd\n*.doska-tmp\n');
  });

  it('недопустимый id доски не превращается в путь к файлу', async () => {
    const fs = createMemoryFileSystem();
    const project = unwrap(await createProject(context(fs, 'pc'), 'Игра'));
    await expect(project.openBoard('../../x' as BoardId)).rejects.toThrow('Недопустимый id доски');
  });
});

describe('два устройства', () => {
  it('телефон открывает проект с ПК, правки сходятся в обе стороны', async () => {
    const pcFs = createMemoryFileSystem();
    const phoneFs = createMemoryFileSystem();
    const pc = unwrap(await createProject(context(pcFs, 'pc'), 'Игра'));
    const npc = addChildBoard(pc, 'board-npc', 'НПС');
    await pc.flushAll();
    sync(pcFs, phoneFs, 'pc');

    const phone = unwrap(await openProject(context(phoneFs, 'phone')));
    addChildBoard(phone, 'board-loc', 'Локации');
    const phoneBoard = await phone.openBoard(npc);
    phoneBoard.doc.getMap('elements').set('el-phone', createRecord({ id: 'el-phone' }));
    await phone.flushAll();

    const pcBoard = await pc.openBoard(npc);
    pcBoard.doc.getMap('elements').set('el-pc', createRecord({ id: 'el-pc' }));
    await pc.flushAll();

    sync(phoneFs, pcFs, 'phone');
    sync(pcFs, phoneFs, 'pc');
    await pc.refreshAll();
    await phone.refreshAll();

    const titles = (project: OpenProject) =>
      readBoards(project.projectDoc.doc)
        .items.map((board) => board.title)
        .sort();
    expect(titles(pc)).toEqual(['Игра', 'Локации', 'НПС']);
    expect(titles(phone)).toEqual(titles(pc));
    expect([...pcBoard.doc.getMap('elements').keys()].sort()).toEqual(['el-pc', 'el-phone']);
    expect(readElements(pcBoard.doc).invalid).toHaveLength(2); // записи-заглушки без полей не проходят схему
  });
});
