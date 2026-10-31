import { describe, expect, it } from 'vitest';
import * as Y from 'yjs';
import {
  createManualClock,
  createSequentialIdGenerator,
  type BoardId,
  type ElementId,
  type NewElement,
} from '../../core';
import { readElements } from '../projectDocument';
import { executeBoardCommand } from './boardCommands';
import { createUndoHistory } from './undo';

const BOARD = 'board-root' as BoardId; // заведомо корректный id
const environment = () => ({
  clock: createManualClock(1000),
  ids: createSequentialIdGenerator('el'),
});
const spec = (x: number, text: string): NewElement => ({
  type: 'note',
  placement: { x, y: 0, width: 100, height: 50 },
  color: 'yellow',
  data: { text },
});

describe('создание пачки элементов', () => {
  it('создаёт всё поверх существующих, в заданном порядке, одним шагом отмены', () => {
    const doc = new Y.Doc();
    const env = environment();
    executeBoardCommand(doc, BOARD, { kind: 'createElement', ...spec(0, 'старый') }, env);
    const undo = createUndoHistory(doc, ['elements']);
    const result = executeBoardCommand(
      doc,
      BOARD,
      { kind: 'createElements', elements: [spec(10, 'а'), { ...spec(20, 'б'), locked: true }] },
      env,
    );
    if (!result.ok) throw new Error(result.error);
    const ids = result.value.createdIds ?? [];
    expect(ids).toHaveLength(2);
    expect(result.value.createdId).toBe(ids[0]);
    const byId = new Map<string, unknown>(readElements(doc).items.map((item) => [item.id, item]));
    expect(byId.get(ids[0] ?? '')).toMatchObject({ z: 2, color: 'yellow', locked: false });
    expect(byId.get(ids[1] ?? '')).toMatchObject({ z: 3, locked: true, data: { text: 'б' } });
    undo.undo();
    expect(readElements(doc).items).toHaveLength(1);
  });

  it('если один элемент невалиден — не создаётся ни один', () => {
    const doc = new Y.Doc();
    const bad = { ...spec(0, 'x'), placement: { x: 0, y: 0, width: -1, height: 5 } };
    const result = executeBoardCommand(
      doc,
      BOARD,
      { kind: 'createElements', elements: [spec(0, 'ok'), bad] },
      environment(),
    );
    expect(result.ok).toBe(false);
    expect(readElements(doc).items).toHaveLength(0);
  });

  it('правит несколько элементов одним шагом', () => {
    const doc = new Y.Doc();
    const env = environment();
    const created = executeBoardCommand(
      doc,
      BOARD,
      { kind: 'createElements', elements: [spec(0, 'а'), spec(10, 'б')] },
      env,
    );
    if (!created.ok) throw new Error(created.error);
    const ids = (created.value.createdIds ?? []) as ElementId[];
    const undo = createUndoHistory(doc, ['elements']);
    executeBoardCommand(
      doc,
      BOARD,
      { kind: 'updateElements', elementIds: ids, changes: { locked: true } },
      env,
    );
    expect(readElements(doc).items.every((item) => item.locked)).toBe(true);
    const [first] = ids;
    if (first === undefined) throw new Error('не созданы');
    const moved = executeBoardCommand(
      doc,
      BOARD,
      { kind: 'moveElements', moves: [{ elementId: first, x: 5, y: 5 }] },
      env,
    );
    expect(moved.ok).toBe(false);
    undo.undo();
    expect(readElements(doc).items.some((item) => item.locked)).toBe(false);
  });
});

describe('контейнеры', () => {
  it('колонка с карточками создаётся одной пачкой; перенос в колонку и обратно', () => {
    const doc = new Y.Doc();
    const env = environment();
    const created = executeBoardCommand(
      doc,
      BOARD,
      {
        kind: 'createElements',
        elements: [
          { type: 'column', placement: { x: 0, y: 0, width: 280, height: 100 }, data: {} },
          { ...spec(0, 'в колонке'), parentIndex: 0 },
          spec(500, 'снаружи'),
        ],
      },
      env,
    );
    if (!created.ok) throw new Error(created.error);
    const [column, inside, outside] = (created.value.createdIds ?? []) as ElementId[];
    if (column === undefined || inside === undefined || outside === undefined)
      throw new Error('не созданы');
    const parentOf = (id: string) =>
      readElements(doc).items.find((item) => item.id === id)?.parentId;
    expect(parentOf(inside)).toBe(column);

    const placed = executeBoardCommand(
      doc,
      BOARD,
      {
        kind: 'placeElements',
        placements: [
          { elementId: outside, x: 0, y: 20, parentId: column },
          { elementId: inside, x: 700, y: 700, parentId: null },
        ],
      },
      env,
    );
    expect(placed.ok).toBe(true);
    expect(parentOf(outside)).toBe(column);
    expect(parentOf(inside)).toBeNull();
    const nested = executeBoardCommand(
      doc,
      BOARD,
      { kind: 'placeElements', placements: [{ elementId: column, x: 0, y: 0, parentId: column }] },
      env,
    );
    expect(nested.ok).toBe(false);
  });

  it('ссылка на контейнер вперёд по пачке отклоняется', () => {
    const result = executeBoardCommand(
      new Y.Doc(),
      BOARD,
      { kind: 'createElements', elements: [{ ...spec(0, 'a'), parentIndex: 0 }] },
      environment(),
    );
    expect(result.ok).toBe(false);
  });
});
