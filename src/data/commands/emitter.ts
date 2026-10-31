/** Подписчики одного события: подписка возвращает отписку. */
export interface Emitter<T> {
  readonly subscribe: (listener: (value: T) => void) => () => void;
  readonly emit: (value: T) => void;
  readonly clear: () => void;
}

export function createEmitter<T = void>(): Emitter<T> {
  const listeners = new Set<(value: T) => void>();
  return {
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    emit: (value) => {
      listeners.forEach((listener) => {
        listener(value);
      });
    },
    clear: () => {
      listeners.clear();
    },
  };
}
