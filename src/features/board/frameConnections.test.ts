import { afterEach, describe, expect, it } from 'vitest';
import * as Y from 'yjs';
import {
  createManualClock,
  createSequentialIdGenerator,
  type BoardId,
  type ConnectionId,
  type ElementId,
} from '../../core';
import { createBoardModel, type BoardModel } from './model';
import { nudgeSelection } from './boardActions';
import { regionConnectionMoves } from './regionMoves';

let current: BoardModel | undefined;
afterEach(() => {
  current?.destroy();
  current?.doc.destroy();
});

function setup() {
  const doc = new Y.Doc();
  const model = createBoardModel(doc, 'board-0001' as BoardId, {
    clock: createManualClock(1),
    ids: createSequentialIdGenerator('frame'),
  }); // корректный id
  current = model;
  const result = model.run({
    kind: 'createElements',
    elements: [
      { type: 'frame', placement: { x: 0, y: 0, width: 800, height: 600 }, data: {} },
      { type: 'note', placement: { x: 60, y: 80, width: 200, height: 120 }, data: {} },
    ],
  });
  const [frame, note] = result?.createdIds ?? [];
  if (frame === undefined || note === undefined) throw new Error('Нет элементов');
  const noteId = note as ElementId; // id из результата создания
  const lines = [
    model.run({
      kind: 'createConnection',
      from: { kind: 'point', x: 30, y: 30 },
      to: { kind: 'point', x: 600, y: 500 },
    })?.createdId,
    model.run({
      kind: 'createConnection',
      from: { kind: 'point', x: 30, y: 30 },
      to: { kind: 'element', elementId: noteId, side: 'left' },
    })?.createdId,
    model.run({
      kind: 'createConnection',
      from: { kind: 'point', x: 30, y: 30 },
      to: { kind: 'point', x: 1600, y: 500 },
    })?.createdId,
  ];
  model.interaction.setState({ selection: new Set([frame]) });
  return {
    doc,
    model,
    frame,
    noteId,
    lines,
    connections: () =>
      [...model.connections.getSnapshot().values()].sort((a, b) => a.id.localeCompare(b.id)),
  };
}

describe('стрелки внутри рамки', () => {
  it('свободные и смешанные концы едут с зоной, внешняя стрелка сохраняет свободные точки; одна транзакция и отмена', () => {
    const { doc, model, frame, connections } = setup();
    const before = connections();
    const preview = regionConnectionMoves(model.elements.getSnapshot(), before, [
      { id: frame, x: 16, y: 32 },
    ]);
    expect(preview).toHaveLength(2);
    let transactions = 0;
    const count = () => {
      transactions += 1;
    };
    doc.on('afterTransaction', count);
    nudgeSelection(model, 16, 32);
    doc.off('afterTransaction', count);
    expect(transactions).toBe(1);
    expect(connections()[0]).toMatchObject({
      from: { kind: 'point', x: 46, y: 62 },
      to: { kind: 'point', x: 616, y: 532 },
    });
    expect(connections()[1]).toMatchObject({
      from: { kind: 'point', x: 46, y: 62 },
      to: before[1]?.to,
    });
    expect(connections()[2]).toEqual(before[2]);
    model.undo.undo();
    expect(connections()).toEqual(before);
    expect(model.elements.getSnapshot().get(frame)?.x).toBe(0);
    model.undo.redo();
    expect(connections()[0]?.from).toMatchObject({ x: 46, y: 62 });
  });

  it('невалидная стрелка отменяет весь перенос до записи', () => {
    const { model, noteId, connections, lines } = setup();
    const id = lines[0] as ConnectionId; // id созданной стрелки
    const before = connections();
    const result = model.run({
      kind: 'moveElements',
      moves: [{ elementId: noteId, x: 500, y: 500 }],
      connections: [
        {
          connectionId: id,
          from: { kind: 'point', x: Number.NaN, y: 0 },
          to: { kind: 'point', x: 1, y: 1 },
        },
      ],
    });
    expect(result).toBeNull();
    expect(model.elements.getSnapshot().get(noteId)?.x).toBe(60);
    expect(connections()).toEqual(before);
  });

  it('невалидное положение карточки сохраняет все стрелки и остальные карточки', () => {
    const { model, frame, connections } = setup();
    const before = connections();
    nudgeSelection(model, 20_000_000, 0);
    expect(model.elements.getSnapshot().get(frame)?.x).toBe(0);
    expect(connections()).toEqual(before);
  });
});
