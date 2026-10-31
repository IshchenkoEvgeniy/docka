import { describe, expect, it } from 'vitest';
import * as Y from 'yjs';
import {
  createManualClock,
  createMemoryFileSystem,
  createSequentialIdGenerator,
  type BoardCommand,
  type BoardId,
  type ElementId,
  type ProjectCommand,
} from '../../core';
import { openDocument } from '../documentStore';
import {
  insertBoard,
  readBoards,
  readConnections,
  readElements,
  readTags,
} from '../projectDocument';
import { executeBoardCommand } from './boardCommands';
import { executeProjectCommand } from './projectCommands';
import { UNDO_LIMIT, createUndoHistory } from './undo';

const environment = () => ({
  clock: createManualClock(5000),
  ids: createSequentialIdGenerator('obj'),
});
const ROOT = 'board-root' as BoardId; // заведомо корректный id

function projectDoc() {
  const doc = new Y.Doc();
  insertBoard(doc, {
    id: ROOT,
    title: 'Игра',
    parentId: null,
    icon: null,
    color: 'default',
    background: 'dots',
    tags: {},
    createdAt: 0,
    updatedAt: 0,
    deletedAt: null,
  });
  return doc;
}

function run(doc: Y.Doc, command: ProjectCommand, env = environment()) {
  return executeProjectCommand(doc, command, env);
}

function createdId(result: ReturnType<typeof run>): string {
  if (!result.ok || result.value.createdId === undefined)
    throw new Error('команда не создала объект');
  return result.value.createdId;
}

const note = (x = 0): BoardCommand => ({
  kind: 'createElement',
  type: 'note',
  placement: { x, y: 0, width: 200, height: 100 },
  data: { text: 'Таверна', style: { bold: true } },
});

function boardRun(doc: Y.Doc, command: BoardCommand, env = environment()) {
  return executeBoardCommand(doc, ROOT, command, env);
}

const elements = (doc: Y.Doc) => readElements(doc).items;
const element = (doc: Y.Doc, id: string) => elements(doc).find((item) => item.id === id);

describe('команды проекта', () => {
  it('создают доску и не создают её у несуществующего родителя', () => {
    const doc = projectDoc();
    const id = createdId(run(doc, { kind: 'createBoard', parentId: ROOT, title: 'НПС' }));
    expect(readBoards(doc).items.find((board) => board.id === id)).toMatchObject({
      title: 'НПС',
      parentId: ROOT,
      createdAt: 5000,
    });
    const before = Y.encodeStateAsUpdate(doc);
    expect(
      run(doc, { kind: 'createBoard', parentId: 'board-none' as BoardId, title: 'X' }).ok,
    ).toBe(false);
    expect(Y.encodeStateAsUpdate(doc)).toEqual(before);
  });

  it('перенос доски: нельзя в себя, в потомка и нельзя переносить корень', () => {
    const doc = projectDoc();
    const env = environment();
    const npc = createdId(
      run(doc, { kind: 'createBoard', parentId: ROOT, title: 'НПС' }, env),
    ) as BoardId;
    const tavern = createdId(
      run(doc, { kind: 'createBoard', parentId: npc, title: 'Таверна' }, env),
    ) as BoardId;
    expect(run(doc, { kind: 'moveBoard', boardId: npc, newParentId: tavern })).toMatchObject({
      ok: false,
    });
    expect(run(doc, { kind: 'moveBoard', boardId: ROOT, newParentId: npc })).toMatchObject({
      ok: false,
    });
    expect(run(doc, { kind: 'moveBoard', boardId: tavern, newParentId: ROOT }).ok).toBe(true);
    expect(readBoards(doc).items.find((board) => board.id === tavern)?.parentId).toBe(ROOT);
  });

  it('невалидное изменение доски отклоняется целиком', () => {
    const doc = projectDoc();
    const before = Y.encodeStateAsUpdate(doc);
    const result = run(doc, {
      kind: 'updateBoard',
      boardId: ROOT,
      changes: { title: 'Новое', color: 'неон' as 'red' },
    });
    expect(result.ok).toBe(false);
    expect(Y.encodeStateAsUpdate(doc)).toEqual(before);
  });

  it('пустое название проекта отклоняется; тег нормализуется', () => {
    const doc = projectDoc();
    expect(run(doc, { kind: 'renameProject', name: '   ' }).ok).toBe(false);
    run(doc, { kind: 'createTag', name: ' мир / локации ', color: 'green' });
    expect(readTags(doc).items[0]?.name).toBe('мир/локации');
  });
});

describe('команды доски', () => {
  it('новый элемент ложится поверх остальных, data хранится по полям', () => {
    const doc = new Y.Doc();
    const env = environment();
    const first = createdId(boardRun(doc, note(), env));
    const second = createdId(boardRun(doc, note(300), env));
    expect(element(doc, second)?.z).toBeGreaterThan(element(doc, first)?.z ?? Infinity);
    expect(
      boardRun(doc, {
        kind: 'updateElement',
        elementId: first as ElementId,
        changes: { data: { style: { italic: true } } },
      }).ok,
    ).toBe(true);
    expect(element(doc, first)?.data).toEqual({
      text: 'Таверна',
      style: { bold: true, italic: true },
    });
  });

  it('элемент с неизвестным типом или размером 0 не создаётся', () => {
    const doc = new Y.Doc();
    expect(boardRun(doc, { ...note(), type: 'Плохой тип' } as BoardCommand).ok).toBe(false);
    expect(
      boardRun(doc, {
        kind: 'createElement',
        type: 'note',
        placement: { x: 0, y: 0, width: 0, height: 10 },
        data: {},
      }).ok,
    ).toBe(false);
    expect(doc.getMap('elements').size).toBe(0);
  });

  it('перемещение группы — всё или ничего', () => {
    const doc = new Y.Doc();
    const id = createdId(boardRun(doc, note())) as ElementId;
    const result = boardRun(doc, {
      kind: 'moveElements',
      moves: [
        { elementId: id, x: 50, y: 60 },
        { elementId: 'obj-missing' as ElementId, x: 1, y: 1 },
      ],
    });
    expect(result.ok).toBe(false);
    expect(element(doc, id)).toMatchObject({ x: 0, y: 0 });
  });

  it('закреплённый элемент не двигается и не меняет размер', () => {
    const doc = new Y.Doc();
    const id = createdId(boardRun(doc, note())) as ElementId;
    boardRun(doc, { kind: 'updateElement', elementId: id, changes: { locked: true } });
    expect(
      boardRun(doc, { kind: 'moveElements', moves: [{ elementId: id, x: 9, y: 9 }] }),
    ).toMatchObject({ ok: false });
    expect(
      boardRun(doc, {
        kind: 'resizeElement',
        elementId: id,
        placement: { x: 0, y: 0, width: 5, height: 5 },
      }),
    ).toMatchObject({ ok: false });
  });

  it('на передний и задний план', () => {
    const doc = new Y.Doc();
    const env = environment();
    const ids = [note(), note(1), note(2)].map(
      (command) => createdId(boardRun(doc, command, env)) as ElementId,
    );
    const [a, , c] = ids;
    if (a === undefined || c === undefined) throw new Error('нет элементов');
    boardRun(doc, { kind: 'reorderElements', elementIds: [a], to: 'front' });
    boardRun(doc, { kind: 'reorderElements', elementIds: [c], to: 'back' });
    const order = [...elements(doc)].sort((x, y) => x.z - y.z).map((item) => item.id);
    expect(order).toEqual([c, ids[1], a]);
  });

  it('стрелка: только к существующим элементам; конец меняется целиком', () => {
    const doc = new Y.Doc();
    const env = environment();
    const id = createdId(boardRun(doc, note(), env)) as ElementId;
    expect(
      boardRun(
        doc,
        {
          kind: 'createConnection',
          from: { kind: 'element', elementId: 'obj-none' as ElementId, side: 'auto' },
          to: { kind: 'point', x: 0, y: 0 },
        },
        env,
      ).ok,
    ).toBe(false);
    const arrow = createdId(
      boardRun(
        doc,
        {
          kind: 'createConnection',
          from: { kind: 'element', elementId: id, side: 'right' },
          to: { kind: 'point', x: 500, y: 0 },
        },
        env,
      ),
    );
    boardRun(doc, {
      kind: 'updateConnection',
      connectionId: arrow as never,
      changes: { from: { kind: 'point', x: 1, y: 2 } },
    });
    const raw: unknown = (doc.getMap('connections').get(arrow) as Y.Map<unknown>).toJSON(); // запись создана командой
    // Без лишних полей от прежнего конца (elementId, side): toHaveProperty сравнивает значение целиком.
    expect(raw).toHaveProperty('from', { kind: 'point', x: 1, y: 2 });
    expect(readConnections(doc).items).toHaveLength(1);
  });
});

describe('отмена', () => {
  it('одна команда — один шаг, даже если команды идут подряд', () => {
    const doc = new Y.Doc();
    const history = createUndoHistory(doc, ['elements', 'connections']);
    const env = environment();
    boardRun(doc, note(), env);
    boardRun(doc, note(1), env);
    history.undo();
    expect(elements(doc)).toHaveLength(1);
    history.redo();
    expect(elements(doc)).toHaveLength(2);
  });

  it('правки с другого устройства не отменяются', () => {
    const doc = new Y.Doc();
    const history = createUndoHistory(doc, ['elements']);
    const phone = new Y.Doc();
    boardRun(phone, note(), environment());
    Y.applyUpdate(doc, Y.encodeStateAsUpdate(phone), 'from-disk');
    boardRun(doc, note(5), { clock: createManualClock(0), ids: createSequentialIdGenerator('pc') });
    history.undo();
    expect(history.canUndo()).toBe(false);
    expect(elements(doc).map((item) => item.id)).toEqual(['obj-00000001']);
  });

  it('история ограничена, но не меньше 100 шагов', () => {
    const doc = new Y.Doc();
    const history = createUndoHistory(doc, ['elements']);
    const env = environment();
    for (let i = 0; i < UNDO_LIMIT + 20; i += 1) boardRun(doc, note(i), env);
    let steps = 0;
    while (history.undo()) steps += 1;
    expect(steps).toBe(UNDO_LIMIT);
    expect(UNDO_LIMIT).toBeGreaterThanOrEqual(100);
  });

  it('отмена сохраняется на диск как обычная правка', async () => {
    const fs = createMemoryFileSystem();
    const stored = await openDocument({ fs, deviceId: 'pc' }, ROOT);
    const history = createUndoHistory(stored.doc, ['elements']);
    boardRun(stored.doc, note());
    await stored.flush();
    history.undo();
    await stored.flush();
    const reopened = await openDocument({ fs, deviceId: 'pc' }, ROOT);
    expect(elements(reopened.doc)).toHaveLength(0);
  });
});
