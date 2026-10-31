import { useCallback, useSyncExternalStore } from 'react';
import type { AssetState, AssetStore } from '../../data';
import { useElementRuntime } from '../runtime';

const NO_ASSETS: AssetState = { status: 'missing' };
const noop = () => () => undefined;

/** Состояние файла проекта из хранилища; обновляется, когда файл прочитан или доехал. */
export function useAssetIn(assets: AssetStore | null, name: string): AssetState {
  const subscribe = assets === null ? noop : assets.subscribe;
  const getSnapshot = useCallback(
    () => (assets === null ? NO_ASSETS : assets.get(name)),
    [assets, name],
  );
  return useSyncExternalStore(subscribe, getSnapshot);
}

/** Файл проекта для элемента на доске. */
export function useAsset(name: string): AssetState {
  return useAssetIn(useElementRuntime().assets, name);
}
