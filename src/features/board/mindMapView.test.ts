import { describe, expect, it } from 'vitest';
import * as Y from 'yjs';
import {
  createManualClock,
  createSequentialIdGenerator,
  type BoardId,
  type ElementId,
} from '../../core';
import { createBoardElementsStore, executeBoardCommand } from '../../data';
import { createMindMapView } from './mindMapView';

const BOARD = 'board-quests' as BoardId; // тестовая доска

function setup() {
  const doc = new Y.Doc();
  const environment = { clock: createManualClock(1), ids: createSequentialIdGenerator('pc') };
  const run = (command: Parameters<typeof executeBoardCommand>[2]): ElementId => {
    const result = executeBoardCommand(doc, BOARD, command, environment);
    if (!result.ok) throw new Error(result.error);
    return (result.value.createdId ?? '') as ElementId; // id новой карточки
  };
  const note = { type: 'note', placement: { x: 0, y: 0, width: 200, height: 40 }, data: {} };
  const root = run({ kind: 'createElement', ...note });
  run({ kind: 'makeMindMapRoot', elementId: root });
  const a = run({ kind: 'addMindMapNode', anchorId: root, relation: 'child', element: note });
  const a1 = run({ kind: 'addMindMapNode', anchorId: a, relation: 'child', element: note });
  const plain = run({ kind: 'createElement', ...note });
  return { doc, run, root, a, a1, plain };
}

describe('видимые элементы доски с майнд-картами', () => {
  it('свёрнутая ветка прячет потомков, сам узел виден; объекты элементов те же', () => {
    const { doc, run, a, a1, plain } = setup();
    const view = createMindMapView(createBoardElementsStore(doc));
    const before = view.visible.getSnapshot();
    expect(before.has(a1)).toBe(true);
    run({ kind: 'setMindMapCollapsed', elementId: a, collapsed: true });
    const after = view.visible.getSnapshot();
    expect(after.has(a1)).toBe(false);
    expect(after.has(a)).toBe(true);
    expect(after.get(plain)).toBe(before.get(plain));
    expect(view.maps.getSnapshot().hidden).toEqual(new Set([a1]));
    expect(view.maps.getSnapshot().forest.nodes.has(a1)).toBe(true);
  });

  it('без изменений снимок не пересоздаётся', () => {
    const { doc } = setup();
    const view = createMindMapView(createBoardElementsStore(doc));
    expect(view.visible.getSnapshot()).toBe(view.visible.getSnapshot());
    expect(view.maps.getSnapshot()).toBe(view.maps.getSnapshot());
  });
});
