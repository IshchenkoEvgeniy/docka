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
  let listening = false;
  const update = (): void => {
    boards = read();
    listeners.forEach((listener) => {
      listener();
    });
  };
  const stop = (): void => {
    projectDoc.off('update', update);
    listening = false;
  };
  return {
    subscribe: (listener) => {
      if (!listening) {
        boards = read();
        projectDoc.on('update', update);
        listening = true;
      }
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
        if (listeners.size === 0) stop();
      };
    },
    get: (boardId) => {
      if (!listening) boards = read();
      return boards.get(boardId) ?? null;
    },
    destroy: () => {
      stop();
      listeners.clear();
    },
  };
}
