/**
 * Слежение за папкой проекта: сообщает, что файлы изменились снаружи (например, их привёз Syncthing).
 * На телефоне реализация может опрашивать папку по таймеру — интерфейс от этого не меняется.
 */
export interface FolderWatcher {
  /** Подписка на изменения внутри path; changedPaths — относительные пути. Возвращает отписку. */
  readonly watch: (path: string, onChange: (changedPaths: readonly string[]) => void) => () => void;
}

export interface ManualFolderWatcher extends FolderWatcher {
  /** Сообщает подписчикам об изменении файлов — как это сделала бы ОС. */
  readonly emit: (changedPaths: readonly string[]) => void;
}

/** Слежение для тестов: изменения объявляются вручную. */
export function createManualFolderWatcher(): ManualFolderWatcher {
  const subscribers = new Set<{ path: string; onChange: (paths: readonly string[]) => void }>();
  return {
    watch: (path, onChange) => {
      const subscriber = { path, onChange };
      subscribers.add(subscriber);
      return () => {
        subscribers.delete(subscriber);
      };
    },
    emit: (changedPaths) => {
      for (const { path, onChange } of subscribers) {
        const prefix = path === '' ? '' : `${path}/`;
        const relevant = changedPaths.filter((changed) => changed.startsWith(prefix));
        if (relevant.length > 0) onChange(relevant);
      }
    },
  };
}
