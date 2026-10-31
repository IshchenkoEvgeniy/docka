import { useEffect, useState } from 'react';
import type { BoardId, DeviceId, FolderWatcher } from '../../core';
import {
  ensureDailyBackup,
  openProject,
  recordDeviceName,
  startLiveSync,
  type LiveSync,
  type OpenProject,
  type StoredDocument,
} from '../../data';
import { projectLocation, type AppServices } from '../workspace';

/** Правки пишутся на диск через секунду после последней (ТЗ: накопление 1–2 с). */
const AUTOSAVE_MS = 1000;
/** На телефоне слежение за папкой ненадёжно — дополнительно опрос. */
const MOBILE_POLL_MS = 5000;

export type Loading<T> =
  | { readonly status: 'loading' }
  | { readonly status: 'error'; readonly error: string }
  | { readonly status: 'ready'; readonly value: T };

function report(what: string) {
  return (error: unknown): void => {
    console.error(what, error);
  };
}

/** Подписки открытого проекта: правки других устройств, сохранение при уходе в фон. */
function attachProject(
  project: OpenProject,
  services: AppServices,
  watcher: FolderWatcher | null,
): () => void {
  const sync: LiveSync = startLiveSync(project.refreshAll, {
    ...(watcher === null ? {} : { watcher }),
    ...(services.deviceKind === 'mobile' ? { pollMs: MOBILE_POLL_MS } : {}),
    onError: report('Не удалось прочитать правки других устройств'),
  });
  const onFocus = (): void => {
    void sync.refreshNow();
  };
  const onVisibility = (): void => {
    if (document.visibilityState === 'hidden')
      project.flushAll().catch(report('Не удалось сохранить'));
    else onFocus();
  };
  window.addEventListener('focus', onFocus);
  document.addEventListener('visibilitychange', onVisibility);
  if (services.backupsFs !== null)
    ensureDailyBackup(project, services.backupsFs, services.clock.now()).catch(
      report('Резервная копия не создана'),
    );
  return () => {
    window.removeEventListener('focus', onFocus);
    document.removeEventListener('visibilitychange', onVisibility);
    sync.stop();
  };
}

interface ProjectSession {
  readonly project: OpenProject;
  readonly close: () => void;
}

/** Открывает проект и подписывается на правки; null — открыть не удалось (текст в error). */
async function startProject(
  services: AppServices,
  deviceId: DeviceId,
  deviceName: string,
  folder: string,
): Promise<ProjectSession | { readonly error: string }> {
  const location = await projectLocation(services, folder);
  const result = await openProject({
    fs: location.fs,
    deviceId,
    clock: services.clock,
    ids: services.ids,
    autoFlushMs: AUTOSAVE_MS,
    onAutoFlushError: report('Не удалось сохранить правки'),
  });
  if (!result.ok) return { error: result.error };
  const project = result.value;
  const detach = attachProject(project, services, location.watcher);
  recordDeviceName(location.fs, deviceId, deviceName).catch(report('Имя устройства не записано'));
  return {
    project,
    close: () => {
      detach();
      project.close().catch(report('Проект закрылся с ошибкой'));
    },
  };
}

/**
 * Открывает проект на время показа экрана; при уходе — сохраняет и закрывает.
 * folder — имя подпапки в папке проектов или полный путь проекта в другом месте.
 */
export function useOpenProject(
  services: AppServices,
  deviceId: DeviceId,
  deviceName: string,
  folder: string,
): Loading<OpenProject> {
  const [state, setState] = useState<Loading<OpenProject>>({ status: 'loading' });
  useEffect(() => {
    let cancelled = false;
    let cleanup = (): void => undefined;
    setState({ status: 'loading' });
    startProject(services, deviceId, deviceName, folder)
      .then((session) => {
        if ('error' in session) {
          if (!cancelled) setState({ status: 'error', error: session.error });
          return;
        }
        if (cancelled) {
          session.close();
          return;
        }
        cleanup = session.close;
        setState({ status: 'ready', value: session.project });
      })
      .catch((error: unknown) => {
        if (!cancelled) setState({ status: 'error', error: String(error) });
      });
    return () => {
      cancelled = true;
      cleanup();
    };
    // Имя устройства пишется при открытии; переименование подхватится при следующем открытии.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [services, deviceId, folder]);
  return state;
}

/** Документ доски проекта (открывается при первом показе). */
export function useBoardDocument(project: OpenProject, boardId: BoardId): Loading<StoredDocument> {
  const [state, setState] = useState<Loading<StoredDocument>>({ status: 'loading' });
  useEffect(() => {
    let cancelled = false;
    setState({ status: 'loading' });
    project.openBoard(boardId).then(
      (document) => {
        if (!cancelled) setState({ status: 'ready', value: document });
      },
      (error: unknown) => {
        if (!cancelled) setState({ status: 'error', error: String(error) });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [project, boardId]);
  return state;
}
