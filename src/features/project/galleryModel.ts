import { isBoardInTrash, type Board, type BoardId } from '../../core';
import { buildBoardTree, type TreeNode } from './treeModel';

export interface GalleryBoards {
  /** Плитки: закреплённые сверху, дальше — в порядке дерева (корень первым). */
  readonly visible: readonly Board[];
  /** Удалённые в корзину (сами, не вместе с родителем), свежие сверху. */
  readonly deleted: readonly Board[];
}

function flatten(node: TreeNode): Board[] {
  return [node.board, ...node.children.flatMap(flatten)];
}

/** Доски проекта для экрана досок. all — все записи досок, в том числе удалённые. */
export function galleryBoards(
  all: readonly Board[],
  rootId: BoardId,
  pinned: ReadonlySet<BoardId>,
): GalleryBoards {
  const byId = new Map(all.map((board) => [board.id, board]));
  const parentOf = (id: BoardId) => byId.get(id)?.parentId;
  const deletedAtOf = (id: BoardId) => byId.get(id)?.deletedAt;
  const alive = all.filter((board) => !isBoardInTrash(board.id, parentOf, deletedAtOf));
  const tree = buildBoardTree(alive, rootId);
  const ordered = tree === null ? alive : flatten(tree);
  const visible = [
    ...ordered.filter((board) => pinned.has(board.id)),
    ...ordered.filter((board) => !pinned.has(board.id)),
  ];
  const deleted = all
    .filter((board) => board.deletedAt !== null)
    .sort((a, b) => (b.deletedAt ?? 0) - (a.deletedAt ?? 0));
  return { visible, deleted };
}
