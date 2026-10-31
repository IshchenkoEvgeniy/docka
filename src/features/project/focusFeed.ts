/**
 * Переход к элементу после открытия доски (результат поиска): элемент ждёт свою доску —
 * старая доска, ещё не успевшая закрыться, его не заберёт.
 */
export interface FocusFeed {
  readonly push: (boardId: string, elementId: string) => void;
  readonly take: (boardId: string) => string | null;
  readonly subscribe: (listener: () => void) => () => void;
}

export function createFocusFeed(): FocusFeed {
  let pending: { readonly boardId: string; readonly elementId: string } | null = null;
  const listeners = new Set<() => void>();
  return {
    push: (boardId, elementId) => {
      pending = { boardId, elementId };
      listeners.forEach((listener) => {
        listener();
      });
    },
    take: (boardId) => {
      if (pending?.boardId !== boardId) return null;
      const { elementId } = pending;
      pending = null;
      return elementId;
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
