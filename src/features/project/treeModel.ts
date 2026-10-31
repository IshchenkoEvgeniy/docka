import type { Board, BoardId } from '../../core';

export interface TreeNode {
  readonly board: Board;
  readonly children: readonly TreeNode[];
}

/** Дерево досок от корня; дочерние — по времени создания. Доски без живого родителя — у корня. */
export function buildBoardTree(boards: readonly Board[], rootId: BoardId): TreeNode | null {
  const byId = new Map(boards.map((board) => [board.id, board]));
  const children = new Map<BoardId, Board[]>();
  for (const board of boards) {
    if (board.id === rootId) continue;
    const parent = board.parentId !== null && byId.has(board.parentId) ? board.parentId : rootId;
    const list = children.get(parent) ?? [];
    list.push(board);
    children.set(parent, list);
  }
  const visited = new Set<BoardId>();
  const build = (board: Board): TreeNode => {
    visited.add(board.id);
    const kids = (children.get(board.id) ?? [])
      .filter((child) => !visited.has(child.id))
      .sort((a, b) => a.createdAt - b.createdAt || a.title.localeCompare(b.title));
    return { board, children: kids.map(build) };
  };
  const root = byId.get(rootId);
  if (root === undefined) return null;
  const tree = build(root);
  // Цикл (две доски одновременно перенесли друг в друга на разных устройствах) отрезал бы
  // доски от корня: такие показываются у корня, чтобы их можно было вытащить.
  const stranded: TreeNode[] = [];
  for (const item of boards) if (!visited.has(item.id)) stranded.push(build(item));
  return stranded.length === 0 ? tree : { ...tree, children: [...tree.children, ...stranded] };
}
