import { useCallback, useEffect, useRef, useState } from 'react';
import { listProjects, readProjectEntry, sortProjects, type ProjectEntry } from '../../data';
import { t } from '../../i18n';
import { projectLocation, type AppServices } from '../workspace';

const RELOAD_DEBOUNCE_MS = 500;

export interface ProjectsState {
  readonly entries: readonly ProjectEntry[] | null;
  readonly error: string | null;
  readonly reload: () => void;
}

/** Проект вне папки проектов; пропавшая папка показывается, чтобы её можно было убрать из списка. */
async function externalEntry(services: AppServices, path: string): Promise<ProjectEntry> {
  const missing: ProjectEntry = {
    status: 'broken',
    folder: path,
    error: t('home.missing'),
    modifiedAt: null,
  };
  try {
    const location = await projectLocation(services, path);
    return (await readProjectEntry(location.fs, path)) ?? missing;
  } catch {
    return missing;
  }
}

async function loadProjects(
  services: AppServices,
  paths: readonly string[],
): Promise<ProjectEntry[]> {
  const [own, external] = await Promise.all([
    listProjects(services.projectsFs),
    Promise.all(paths.map((path) => externalEntry(services, path))),
  ]);
  return sortProjects([...own, ...external]);
}

/**
 * Проекты папки проектов и запомненные проекты из других папок. Обновляется при изменениях
 * в папке проектов (Syncthing привёз проект) и при возврате в окно.
 */
export function useProjects(services: AppServices, paths: readonly string[]): ProjectsState {
  const [entries, setEntries] = useState<readonly ProjectEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const latest = useRef(0);
  const reload = useCallback(() => {
    const request = ++latest.current;
    loadProjects(services, paths).then(
      (list) => {
        if (request !== latest.current) return;
        setEntries(list);
        setError(null);
      },
      (failure: unknown) => {
        if (request !== latest.current) return;
        setError(String(failure));
      },
    );
  }, [services, paths]);

  useEffect(() => {
    reload();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const later = (): void => {
      clearTimeout(timer);
      timer = setTimeout(reload, RELOAD_DEBOUNCE_MS);
    };
    const stopWatching = services.projectsWatcher?.watch('', later);
    window.addEventListener('focus', reload);
    return () => {
      latest.current += 1;
      clearTimeout(timer);
      stopWatching?.();
      window.removeEventListener('focus', reload);
    };
  }, [services, reload]);

  return { entries, error, reload };
}
