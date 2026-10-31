import { describe, expect, it } from 'vitest';
import * as Y from 'yjs';
import { createManualClock, createSequentialIdGenerator, type BoardId } from '../core';
import { createBoardElementsStore } from './boardElements';
import { executeBoardCommand } from './commands';

const BOARD = 'board-root' as BoardId; // заведомо корректный id
const env = { clock: createManualClock(1), ids: createSequentialIdGenerator('el') };

function create(doc: Y.Doc, x: number): string {
  const result = executeBoardCommand(
    doc,
    BOARD,
    {
      kind: 'createElement',
      type: 'note',
      placement: { x, y: 0, width: 100, height: 50 },
      data: { text: String(x) },
    },
    env,
  );
  if (!result.ok || result.value.createdId === undefined) throw new Error('не создан');
  return result.value.createdId;
}

describe('живой снимок элементов доски', () => {
  it('меняет объект только у изменённого элемента', () => {
    const doc = new Y.Doc();
    const a = create(doc, 0);
    const b = create(doc, 10);
    const store = createBoardElementsStore(doc);
    const before = store.getSnapshot();
    let notified = 0;
    store.subscribe(() => notified++);

    executeBoardCommand(
      doc,
      BOARD,
      { kind: 'moveElements', moves: [{ elementId: a as never, x: 5, y: 5 }] },
      env,
    );
    const after = store.getSnapshot();
    expect(notified).toBe(1);
    expect(after).not.toBe(before);
    expect(after.get(a)?.x).toBe(5);
    expect(after.get(b)).toBe(before.get(b));
  });

  it('вложенные правки data и корзина видны, битые записи пропускаются', () => {
    const doc = new Y.Doc();
    const a = create(doc, 0);
    const store = createBoardElementsStore(doc);
    executeBoardCommand(
      doc,
      BOARD,
      { kind: 'updateElement', elementId: a as never, changes: { data: { text: 'новый' } } },
      env,
    );
    expect(store.getSnapshot().get(a)?.data).toEqual({ text: 'новый' });

    doc.getMap('elements').set('broken', 42);
    expect(store.invalidCount()).toBe(1);
    expect(store.getSnapshot().size).toBe(1);

    executeBoardCommand(doc, BOARD, { kind: 'deleteElements', elementIds: [a as never] }, env);
    expect(store.getSnapshot().size).toBe(0);
    store.destroy();
  });
});
