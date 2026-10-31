import { useEffect, useState } from 'react';
import type * as Y from 'yjs';
import type { Board } from '../../core';
import { readBoards } from '../../data';

/** Доски проекта (без корзины); обновляются при любой правке документа проекта. */
export function useBoards(projectDoc: Y.Doc): readonly Board[] {
  const read = () => readBoards(projectDoc).items.filter((board) => board.deletedAt === null);
  const [boards, setBoards] = useState(read);
  useEffect(() => {
    const update = (): void => {
      setBoards(readBoards(projectDoc).items.filter((board) => board.deletedAt === null));
    };
    update();
    projectDoc.on('update', update);
    return () => {
      projectDoc.off('update', update);
    };
  }, [projectDoc]);
  return boards;
}
