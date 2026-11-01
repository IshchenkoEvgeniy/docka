import { describe, expect, it } from 'vitest';
import * as Y from 'yjs';
import { createManualClock, createSequentialIdGenerator, type BoardId } from '../../core';
import { createElementAt } from './boardActions';
import { createBoardModel } from './model';
import { CARD_TOOLS } from './paletteTools';

function setup() {
  const environment = { clock: createManualClock(1), ids: createSequentialIdGenerator('el') };
  return createBoardModel(new Y.Doc(), 'board-0001' as BoardId, environment); // корректный id
}

const noPickers = { images: () => undefined, files: () => undefined, link: () => undefined };

describe('панель элементов', () => {
  it('значок, брошенный на колонку, кладёт карточку в неё одним шагом отмены', () => {
    const model = setup();
    createElementAt(model, 'column', { x: 0, y: 0 });
    const column = [...model.elements.getSnapshot().values()][0];
    if (column === undefined) throw new Error('колонка не создалась');
    const note = CARD_TOOLS.find((tool) => tool.id === 'note');
    note?.place(model, { x: 0, y: 0 }, noPickers, { columnId: column.id, order: 16 });
    const child = [...model.elements.getSnapshot().values()].find((item) => item.type === 'note');
    expect(child).toMatchObject({ parentId: column.id, y: 16 });
    model.undo.undo();
    expect([...model.elements.getSnapshot().values()].map((item) => item.type)).toEqual(['column']);
  });

  it('колонку в колонку не кладёт', () => {
    const model = setup();
    createElementAt(model, 'column', { x: 0, y: 0 });
    const column = [...model.elements.getSnapshot().values()][0];
    if (column === undefined) throw new Error('колонка не создалась');
    createElementAt(model, 'column', { x: 300, y: 0 }, '', { columnId: column.id, order: 16 });
    const parents = [...model.elements.getSnapshot().values()].map((item) => item.parentId);
    expect(parents).toEqual([null, null]);
  });

  it('линия — отдельная стрелка с концами-точками', () => {
    const model = setup();
    CARD_TOOLS.find((tool) => tool.id === 'line')?.place(model, { x: 100, y: 50 }, noPickers, null);
    const [line] = [...model.connections.getSnapshot().values()];
    expect(line?.from).toEqual({ kind: 'point', x: 0, y: 50 });
    expect(line?.to).toEqual({ kind: 'point', x: 200, y: 50 });
  });
});
