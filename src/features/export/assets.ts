import type { AssetStore } from '../../data';

/** Учитываются файлы, которые запросили именно экспортные карточки, включая картинки сущностей. */
export function trackExportAssets(base: AssetStore | null) {
  const names = new Set<string>();
  const assets: AssetStore | null =
    base === null
      ? null
      : {
          ...base,
          get: (name) => {
            names.add(name);
            return base.get(name);
          },
        };
  const wait = (): Promise<void> => {
    if (base === null) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const check = (): void => {
        if ([...names].some((name) => base.get(name).status === 'loading')) return;
        clearTimeout(timer);
        unsubscribe();
        resolve();
      };
      const unsubscribe = base.subscribe(check);
      const timer = setTimeout(() => {
        unsubscribe();
        reject(new Error('Файлы не прочитаны вовремя'));
      }, 30_000);
      check();
    });
  };
  return { assets, wait };
}
