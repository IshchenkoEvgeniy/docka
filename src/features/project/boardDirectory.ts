import type * as Y from 'yjs';
import { readBoards } from '../../data';
import type { BoardDirectory } from '../../elements';

/** Названия досок проекта для карточек досок; обновляется при правках документа проекта. */
export function createBoardDirectory(projectDoc: Y.Doc): BoardDirectory & { destroy: () => void } {
  const read = () =>
    new Map(
      readBoards(projectDoc).items.map((board) => [
        board.id as string,
        { title: board.title, deleted: board.deletedAt !== null },
      ]),
    );
  let boards = read();
  const listeners = new Set<() => void>();
  const update = (): void => {
    boards = read();
    listeners.forEach((listener) => {
      listener();
    });
  };
  projectDoc.on('update', update);
  return {
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    get: (boardId) => boards.get(boardId) ?? null,
    destroy: () => {
      projectDoc.off('update', update);
      listeners.clear();
    },
  };
}
