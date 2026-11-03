import { describe, expect, it } from 'vitest';
import type { ElementId } from '../model';
import { buildMindMapForest } from './forest';
import { splitMindMapMoves } from './moves';

const tree = (parentId: string | null) => ({
  parentId: parentId as ElementId | null, // тестовые id в допустимом формате
  order: 0,
  collapsed: false,
  offset: parentId === 'root-000' ? { dx: 5, dy: 5 } : null,
});

const forest = buildMindMapForest([
  { id: 'root-000', deletedAt: null, tree: tree(null) },
  { id: 'child-aa', deletedAt: null, tree: tree('root-000') },
  { id: 'grand-a1', deletedAt: null, tree: tree('child-aa') },
  { id: 'plain-00', deletedAt: null },
]);
const at = () => ({ x: 100, y: 100 });
const move = (elementId: string) => ({ elementId, x: 130, y: 90 });

describe('перенос узлов карты', () => {
  it('обычная карточка и корень переносятся как есть', () => {
    const split = splitMindMapMoves(forest, [move('plain-00'), move('root-000')], at);
    expect(split.moves.map((m) => m.elementId)).toEqual(['plain-00', 'root-000']);
    expect(split.offsets).toEqual([]);
  });

  it('узел запоминает сдвиг поверх прежнего', () => {
    const split = splitMindMapMoves(forest, [move('child-aa')], at);
    expect(split.moves).toEqual([]);
    expect(split.offsets).toEqual([{ elementId: 'child-aa', dx: 35, dy: -5 }]);
  });

  it('узел, чей предок переносится тем же действием, следует за предком', () => {
    const withRoot = splitMindMapMoves(forest, [move('root-000'), move('grand-a1')], at);
    expect(withRoot.moves.map((m) => m.elementId)).toEqual(['root-000']);
    expect(withRoot.offsets).toEqual([]);
    const withParent = splitMindMapMoves(forest, [move('child-aa'), move('grand-a1')], at);
    expect(withParent.offsets.map((o) => o.elementId)).toEqual(['child-aa']);
  });
});
