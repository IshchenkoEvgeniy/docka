import { useEffect, useMemo, useState } from 'react';
import type * as Y from 'yjs';
import type { Board } from '../../core';
import { readBoards } from '../../data';

/** Все доски проекта, в том числе в корзине; обновляются при любой правке документа проекта. */
export function useAllBoards(projectDoc: Y.Doc): readonly Board[] {
  const [boards, setBoards] = useState(() => readBoards(projectDoc).items);
  useEffect(() => {
    const update = (): void => {
      setBoards(readBoards(projectDoc).items);
    };
    update();
    projectDoc.on('update', update);
    return () => {
      projectDoc.off('update', update);
    };
  }, [projectDoc]);
  return boards;
}

/** Доски проекта без удалённых. */
export function useBoards(projectDoc: Y.Doc): readonly Board[] {
  const all = useAllBoards(projectDoc);
  return useMemo(() => all.filter((board) => board.deletedAt === null), [all]);
}
