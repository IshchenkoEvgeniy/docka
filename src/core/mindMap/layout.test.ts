import { describe, expect, it } from 'vitest';
import type { ElementId, MindMapLink } from '../model';
import { buildMindMapForest, type MindMapInput } from './forest';
import {
  MIND_MAP_DOWN_LEVEL_GAP as DOWN,
  MIND_MAP_LEVEL_GAP as LEVEL,
  MIND_MAP_SIBLING_GAP as GAP,
  layoutMindMap,
  type NodeBox,
} from './layout';

const link = (parentId: string | null, order: number, extra: Partial<MindMapLink> = {}) =>
  ({
    parentId: parentId as ElementId | null, // тестовые id в допустимом формате
    order,
    collapsed: false,
    offset: null,
    ...extra,
  }) satisfies MindMapLink;

interface TestNode extends MindMapInput, NodeBox {}

const node = (
  id: string,
  parentId: string | null,
  order: number,
  size: { width: number; height: number },
  extra: Partial<MindMapLink> = {},
): TestNode => ({ id, deletedAt: null, tree: link(parentId, order, extra), x: 0, y: 0, ...size });

function layout(nodes: TestNode[], rootId = 'root-000') {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  return layoutMindMap(buildMindMapForest(nodes), rootId, (id) => byId.get(id));
}

const box = { width: 200, height: 40 };

describe('раскладка майнд-карты', () => {
  it('вправо: дети справа от корня, ряд по центру корня', () => {
    const positions = layout([
      { ...node('root-000', null, 0, box, { direction: 'right' }), x: 100, y: 100 },
      node('child-aa', 'root-000', 0, box),
      node('child-bb', 'root-000', 1, box),
    ]);
    const x = 100 + 200 + LEVEL;
    const top = 120 - (40 * 2 + GAP) / 2;
    expect(positions.get('child-aa')).toEqual({ x, y: top });
    expect(positions.get('child-bb')).toEqual({ x, y: top + 40 + GAP });
    expect(positions.has('root-000')).toBe(false);
  });

  it('ветка занимает место по своему поддереву: соседи не наезжают', () => {
    const positions = layout([
      node('root-000', null, 0, box),
      node('child-aa', 'root-000', 0, box),
      node('grand-a1', 'child-aa', 0, box),
      node('grand-a2', 'child-aa', 1, box),
      node('child-bb', 'root-000', 1, box),
    ]);
    const a1 = positions.get('grand-a1');
    const a2 = positions.get('grand-a2');
    const b = positions.get('child-bb');
    if (a1 === undefined || a2 === undefined || b === undefined) throw new Error('нет позиций');
    expect(a2.y - a1.y).toBe(40 + GAP);
    expect(b.y).toBeGreaterThanOrEqual(a2.y + 40 + GAP);
    expect(positions.get('child-aa')?.y).toBe((a1.y + a2.y) / 2);
  });

  it('вниз: дети под корнем, ряд по горизонтали', () => {
    const positions = layout([
      node('root-000', null, 0, box, { direction: 'down' }),
      node('child-aa', 'root-000', 0, box),
      node('child-bb', 'root-000', 1, box),
    ]);
    expect(positions.get('child-aa')?.y).toBe(40 + DOWN);
    expect(positions.get('child-bb')?.x).toBe((positions.get('child-aa')?.x ?? 0) + 200 + GAP);
  });

  it('в обе стороны: левые ветки зеркально слева от корня', () => {
    const positions = layout([
      node('root-000', null, 0, box, { direction: 'both' }),
      node('child-aa', 'root-000', 0, box, { side: 'right' }),
      node('child-bb', 'root-000', 1, box, { side: 'left' }),
      node('grand-b1', 'child-bb', 0, box),
    ]);
    expect(positions.get('child-aa')?.x).toBe(200 + LEVEL);
    expect(positions.get('child-bb')?.x).toBe(-LEVEL - 200);
    expect(positions.get('grand-b1')?.x).toBe(-LEVEL - 200 - LEVEL - 200);
  });

  it('свёрнутая ветка не занимает места и не двигается', () => {
    const positions = layout([
      node('root-000', null, 0, box),
      node('child-aa', 'root-000', 0, box, { collapsed: true }),
      node('grand-a1', 'child-aa', 0, { width: 200, height: 500 }),
    ]);
    expect(positions.has('grand-a1')).toBe(false);
    expect(positions.get('child-aa')?.y).toBe(0);
  });

  it('ручной сдвиг двигает узел вместе с веткой', () => {
    const plain = layout([
      node('root-000', null, 0, box),
      node('child-aa', 'root-000', 0, box),
      node('grand-a1', 'child-aa', 0, box),
    ]);
    const shifted = layout([
      node('root-000', null, 0, box),
      node('child-aa', 'root-000', 0, box, { offset: { dx: 30, dy: -50 } }),
      node('grand-a1', 'child-aa', 0, box),
    ]);
    for (const id of ['child-aa', 'grand-a1']) {
      expect(shifted.get(id)?.x).toBe((plain.get(id)?.x ?? 0) + 30);
      expect(shifted.get(id)?.y).toBe((plain.get(id)?.y ?? 0) - 50);
    }
  });

  it('нет корня — пустая раскладка', () => {
    expect(layout([], 'root-000').size).toBe(0);
  });
});
