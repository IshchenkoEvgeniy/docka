import { describe, expect, it } from 'vitest';
import type { BoardElement, ElementId, MindMapLink } from '../core';
import { mindMapBranches } from './mindMapLines';

const element = (id: string, x: number, parentId: string | null): BoardElement =>
  ({
    id: id as ElementId, // тестовые id
    boardId: 'board-test' as BoardElement['boardId'],
    type: 'note',
    x,
    y: 0,
    width: 100,
    height: 40,
    z: 0,
    parentId: null,
    color: 'blue',
    locked: false,
    tags: {},
    createdAt: 0,
    updatedAt: 0,
    deletedAt: null,
    data: {},
    tree: {
      parentId: parentId as ElementId | null, // тестовые id
      order: 0,
      collapsed: false,
      offset: null,
    } satisfies MindMapLink,
  }) satisfies BoardElement;

const map = (...items: BoardElement[]) => new Map(items.map((item) => [item.id, item]));

describe('линии ветвей', () => {
  it('от правой стороны родителя к левой стороне ребёнка, цвета ребёнка', () => {
    const branches = mindMapBranches(
      map(element('root-000', 0, null), element('child-aa', 300, 'root-000')),
    );
    expect(branches).toHaveLength(1);
    expect(branches[0]?.path.startsWith('M 100 20')).toBe(true);
    expect(branches[0]?.path.endsWith('300 20')).toBe(true);
    expect(branches[0]?.color).toBe('blue');
  });

  it('ветка слева от корня выходит из его левой стороны', () => {
    const [branch] = mindMapBranches(
      map(element('root-000', 0, null), element('child-aa', -300, 'root-000')),
    );
    expect(branch?.path.startsWith('M 0 20')).toBe(true);
  });

  it('нет родителя в снимке (скрыт или не выделен) — нет линии', () => {
    expect(mindMapBranches(map(element('child-aa', 300, 'root-000')))).toEqual([]);
  });
});
