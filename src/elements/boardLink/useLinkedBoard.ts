import { useCallback, useSyncExternalStore } from 'react';
import { useElementRuntime } from '../runtime';

const noSubscribe = () => () => undefined;

export function useLinkedBoard(boardId: string) {
  const { boards } = useElementRuntime();
  const getTitle = useCallback(() => boards?.get(boardId)?.title ?? '', [boards, boardId]);
  const getStatus = useCallback(() => {
    const board = boards?.get(boardId) ?? null;
    return board === null ? 'missing' : board.deleted ? 'deleted' : 'ready';
  }, [boards, boardId]);
  const title = useSyncExternalStore(boards?.subscribe ?? noSubscribe, getTitle);
  const status = useSyncExternalStore(boards?.subscribe ?? noSubscribe, getStatus);
  return { title, status };
}
