import { useEffect, useState } from 'react';
import { createAssetStore, type AssetStore } from '../../data';
import { projectLocation, type AppServices } from '../workspace';

const MOBILE_RETRY_MS = 5000;

/**
 * Файлы открытого проекта. Недостающие (ещё едут по Syncthing) перечитываются, когда
 * в папке assets/ что-то меняется, при возврате в окно и, на телефоне, по таймеру.
 */
export function useProjectAssets(services: AppServices, folder: string): AssetStore | null {
  const [assets, setAssets] = useState<AssetStore | null>(null);
  useEffect(() => {
    let stop: (() => void) | null = null;
    let cancelled = false;
    projectLocation(services, folder).then(
      (location) => {
        if (cancelled) return;
        const store = createAssetStore(location.fs);
        setAssets(store);
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
  return assets;
}
