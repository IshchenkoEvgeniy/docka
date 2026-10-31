import { useCallback, useSyncExternalStore } from 'react';
import type { AssetState } from '../../data';
import { useElementRuntime } from '../runtime';

const NO_ASSETS: AssetState = { status: 'missing' };
const noop = () => () => undefined;

/** Состояние файла проекта; обновляется, когда файл прочитан или доехал по синхронизации. */
export function useAsset(name: string): AssetState {
  const { assets } = useElementRuntime();
  const subscribe = assets === null ? noop : assets.subscribe;
  const getSnapshot = useCallback(
    () => (assets === null ? NO_ASSETS : assets.get(name)),
    [assets, name],
  );
  return useSyncExternalStore(subscribe, getSnapshot);
}
