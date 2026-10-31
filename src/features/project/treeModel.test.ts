import { describe, expect, it } from 'vitest';
import type { Board, BoardId } from '../../core';
import { buildBoardTree, type TreeNode } from './treeModel';

const board = (id: string, parentId: string | null, createdAt = 0): Board =>
  ({ id, parentId, title: id, createdAt }) as unknown as Board; // дереву нужны только эти поля

const shape = (node: TreeNode): unknown => [node.board.id, node.children.map(shape)];

describe('дерево досок', () => {
  it('вложенность, порядок по времени создания, потерянные доски у корня', () => {
    const tree = buildBoardTree(
      [
        board('root', null),
        board('npc', 'root', 2),
        board('locations', 'root', 1),
        board('tavern', 'locations', 3),
        board('orphan', 'deleted-parent', 4),
      ],
      'root' as BoardId,
    );
    expect(tree && shape(tree)).toEqual([
      'root',
      [
        ['locations', [['tavern', []]]],
        ['npc', []],
        ['orphan', []],
      ],
    ]);
  });

  it('доски из цикла не теряются и не зацикливают построение', () => {
    const tree = buildBoardTree(
      [board('root', null), board('a', 'b'), board('b', 'a')],
      'root' as BoardId,
    );
    expect(tree && shape(tree)).toEqual(['root', [['a', [['b', []]]]]]);
  });
});
