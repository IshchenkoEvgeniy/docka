import { describe, expect, it } from 'vitest';
import type { Board, BoardId } from '../../core';
import { galleryBoards } from './galleryModel';

function board(
  id: string,
  parentId: string | null,
  createdAt: number,
  deletedAt: number | null = null,
): Board {
  return {
    id: id as BoardId, // тестовые id
    title: id,
    parentId: parentId as BoardId | null, // тестовые id
    icon: null,
    color: 'default',
    background: 'dots',
    tags: {},
    createdAt,
    updatedAt: createdAt,
    deletedAt,
  };
}

const root = 'root' as BoardId; // тестовый id

describe('экран досок', () => {
  it('корень первым, дальше — по дереву; закреплённые сверху', () => {
    const all = [
      board('root', null, 1),
      board('a', 'root', 2),
      board('a1', 'a', 3),
      board('b', 'root', 4),
    ];
    const ids = (boards: readonly Board[]) => boards.map((item) => item.id);
    expect(ids(galleryBoards(all, root, new Set()).visible)).toEqual(['root', 'a', 'a1', 'b']);
    expect(ids(galleryBoards(all, root, new Set(['b' as BoardId])).visible)).toEqual([
      'b',
      'root',
      'a',
      'a1',
    ]);
  });

  it('удалённая доска уходит вместе с вложенными, в корзине — только она сама', () => {
    const all = [
      board('root', null, 1),
      board('a', 'root', 2, 50),
      board('a1', 'a', 3),
      board('b', 'root', 4, 90),
    ];
    const result = galleryBoards(all, root, new Set());
    expect(result.visible.map((item) => item.id)).toEqual(['root']);
    expect(result.deleted.map((item) => item.id)).toEqual(['b', 'a']);
  });
});
