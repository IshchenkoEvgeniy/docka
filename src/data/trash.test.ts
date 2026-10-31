import { describe, expect, it } from 'vitest';
import * as Y from 'yjs';
import {
  TRASH_RETENTION_MS,
  createManualClock,
  createMemoryFileSystem,
  createSequentialIdGenerator,
  type BoardCommand,
  type BoardId,
  type ElementId,
  type ManualClock,
  type ProjectCommand,
} from '../core';
import { createUndoHistory, executeBoardCommand, executeProjectCommand } from './commands';
import { createProject, openProject, type ProjectContext } from './project';
import { readBoards, readConnections, readElements } from './projectDocument';
import { purgeBoardDocument } from './trashPurge';

const BOARD = 'board-test-1' as BoardId; // заведомо корректный id

function setup() {
  const clock = createManualClock(1_000_000);
  const environment = { clock, ids: createSequentialIdGenerator('obj') };
  const doc = new Y.Doc();
  const run = (command: BoardCommand) => executeBoardCommand(doc, BOARD, command, environment);
  const create = (extra: Partial<Extract<BoardCommand, { kind: 'createElement' }>> = {}) => {
    const result = run({
      kind: 'createElement',
      type: 'note',
      placement: { x: 0, y: 0, width: 10, height: 10 },
      data: {},
      ...extra,
    });
    if (!result.ok || result.value.createdId === undefined) throw new Error('не создан');
    return result.value.createdId as ElementId;
  };
  return { clock, doc, run, create };
}

const alive = (doc: Y.Doc) =>
  readElements(doc)
    .items.filter((e) => e.deletedAt === null)
    .map((e) => e.id)
    .sort();
const aliveArrows = (doc: Y.Doc) =>
  readConnections(doc).items.filter((c) => c.deletedAt === null).length;

describe('корзина элементов', () => {
  it('удаление прячет элемент вместе с содержимым колонки и стрелками; восстановление возвращает всё', () => {
    const { doc, run, create } = setup();
    const column = create({ type: 'column' });
    const inside = create({ parentId: column });
    const other = create();
    run({
      kind: 'createConnection',
      from: { kind: 'element', elementId: inside, side: 'auto' },
      to: { kind: 'element', elementId: other, side: 'auto' },
    });

    expect(run({ kind: 'deleteElements', elementIds: [column] }).ok).toBe(true);
    expect(alive(doc)).toEqual([other]);
    expect(aliveArrows(doc)).toBe(0);

    expect(run({ kind: 'restoreElements', elementIds: [column] }).ok).toBe(true);
    expect(alive(doc)).toEqual([column, inside, other].sort());
    expect(aliveArrows(doc)).toBe(1);
  });

  it('восстановление не возвращает то, что было удалено раньше и отдельно', () => {
    const { clock, doc, run, create } = setup();
    const a = create();
    const b = create();
    run({
      kind: 'createConnection',
      from: { kind: 'element', elementId: a, side: 'auto' },
      to: { kind: 'element', elementId: b, side: 'auto' },
    });
    run({ kind: 'deleteElements', elementIds: [b] });
    clock.advance(1000);
    run({ kind: 'deleteElements', elementIds: [a] });
    run({ kind: 'restoreElements', elementIds: [a] });
    expect(alive(doc)).toEqual([a]);
    expect(aliveArrows(doc)).toBe(0); // стрелка удалена вместе с b, а b всё ещё в корзине
  });

  it('удаление отменяется обычной отменой', () => {
    const { doc, run, create } = setup();
    const id = create();
    const history = createUndoHistory(doc, ['elements', 'connections']);
    run({ kind: 'deleteElements', elementIds: [id] });
    history.undo();
    expect(alive(doc)).toEqual([id]);
  });

  it('несуществующий элемент — ошибка без изменений', () => {
    const { doc, run, create } = setup();
    create();
    const before = Y.encodeStateAsUpdate(doc);
    expect(run({ kind: 'deleteElements', elementIds: ['obj-none' as ElementId] }).ok).toBe(false);
    expect(Y.encodeStateAsUpdate(doc)).toEqual(before);
  });

  it('через 30 дней удаляется окончательно, раньше — нет; «Отменить» не возвращает', () => {
    const { clock, doc, run, create } = setup();
    const id = create();
    run({ kind: 'deleteElements', elementIds: [id] });
    const history = createUndoHistory(doc, ['elements']);
    clock.advance(TRASH_RETENTION_MS - 1);
    expect(purgeBoardDocument(doc, clock.now())).toBe(0);
    clock.advance(1);
    expect(purgeBoardDocument(doc, clock.now())).toBe(1);
    expect(doc.getMap('elements').size).toBe(0);
    expect(history.canUndo()).toBe(false);
  });
});

describe('корзина досок', () => {
  function context(clock: ManualClock): ProjectContext {
    return {
      fs: createMemoryFileSystem(),
      deviceId: 'pc',
      clock,
      ids: createSequentialIdGenerator('id'),
    };
  }

  async function projectWithBoards(clock: ManualClock) {
    const ctx = context(clock);
    const created = await createProject(ctx, 'Игра');
    if (!created.ok) throw new Error(created.error);
    const project = created.value;
    const run = (command: ProjectCommand) =>
      executeProjectCommand(project.projectDoc.doc, command, ctx);
    const make = (parentId: BoardId, title: string) => {
      const result = run({ kind: 'createBoard', parentId, title });
      if (!result.ok || result.value.createdId === undefined) throw new Error('не создана');
      return result.value.createdId as BoardId;
    };
    const npc = make(project.meta.rootBoardId, 'НПС');
    const tavern = make(npc, 'Таверна');
    return { ctx, project, run, npc, tavern };
  }

  it('корень удалить нельзя; дочернюю доску из удалённой — восстанавливается в корень', async () => {
    const clock = createManualClock(0);
    const { project, run, npc, tavern } = await projectWithBoards(clock);
    expect(run({ kind: 'deleteBoard', boardId: project.meta.rootBoardId }).ok).toBe(false);
    run({ kind: 'deleteBoard', boardId: npc });
    run({ kind: 'deleteBoard', boardId: tavern });
    run({ kind: 'restoreBoard', boardId: tavern });
    const restored = readBoards(project.projectDoc.doc).items.find((board) => board.id === tavern);
    expect(restored).toMatchObject({ deletedAt: null, parentId: project.meta.rootBoardId });
  });

  it('через 30 дней доска и вложенные удаляются при открытии проекта вместе с файлами своего устройства', async () => {
    const clock = createManualClock(0);
    const { ctx, project, run, npc, tavern } = await projectWithBoards(clock);
    const board = await project.openBoard(tavern);
    executeBoardCommand(
      board.doc,
      tavern,
      {
        kind: 'createElement',
        type: 'note',
        placement: { x: 0, y: 0, width: 1, height: 1 },
        data: {},
      },
      ctx,
    );
    run({ kind: 'deleteBoard', boardId: npc });
    await project.close();
    expect(await ctx.fs.readFile(`data/pc/${tavern}.log`)).not.toBeNull();

    clock.advance(TRASH_RETENTION_MS);
    const reopened = await openProject(ctx);
    if (!reopened.ok) throw new Error(reopened.error);
    expect(readBoards(reopened.value.projectDoc.doc).items.map((b) => b.title)).toEqual(['Игра']);
    expect(await ctx.fs.readFile(`data/pc/${tavern}.log`)).toBeNull();
  });
});
