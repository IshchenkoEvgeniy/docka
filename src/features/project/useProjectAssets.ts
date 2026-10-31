import { useEffect, useState } from 'react';
import { ASSETS_DIR, createAssetStore, type AssetStore } from '../../data';
import { projectLocation, type AppServices } from '../workspace';

const MOBILE_RETRY_MS = 5000;

/**
 * Файлы открытого проекта. Недостающие (ещё едут по Syncthing) перечитываются, когда
 * в папке assets/ что-то меняется, при возврате в окно и, на телефоне, по таймеру.
 */
export interface ProjectFiles {
  readonly assets: AssetStore | null;
  /** Файл из assets/ — системной программой; null — нельзя на этой платформе. */
  readonly openAsset: ((asset: string, mime: string) => Promise<void>) | null;
}

export function useProjectAssets(services: AppServices, folder: string): ProjectFiles {
  const [files, setFiles] = useState<ProjectFiles>({ assets: null, openAsset: null });
  useEffect(() => {
    let stop: (() => void) | null = null;
    let cancelled = false;
    projectLocation(services, folder).then(
      (location) => {
        if (cancelled) return;
        const store = createAssetStore(location.fs);
        const open = location.open;
        setFiles({
          assets: store,
          openAsset: open === null ? null : (asset, mime) => open(`${ASSETS_DIR}/${asset}`, mime),
        });
        const retry = (): void => {
          store.retryMissing();
        };
        const stopWatching = location.watcher?.watch('assets', retry);
        const timer =
          services.deviceKind === 'mobile' ? setInterval(retry, MOBILE_RETRY_MS) : undefined;
        window.addEventListener('focus', retry);
        stop = () => {
          stopWatching?.();
          clearInterval(timer);
          window.removeEventListener('focus', retry);
          store.dispose();
        };
      },
      (error: unknown) => {
        console.error('Файлы проекта недоступны', error);
      },
    );
    return () => {
      cancelled = true;
      stop?.();
    };
  }, [services, folder]);
  return files;
}
