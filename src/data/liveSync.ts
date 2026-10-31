import type { FolderWatcher } from '../core';
import type { RefreshReport } from './documentStore';

/**
 * Живое слияние правок других устройств: когда в `data/` что-то меняется (Syncthing привёз
 * файлы), открытые документы перечитываются. Событие слежения — только подсказка (ADR 0002),
 * поэтому перечитываются папки устройств целиком, а не перечисленные файлы.
 * Для платформ, где слежение ненадёжно (телефон), есть опрос по таймеру.
 */

export interface LiveSyncOptions {
  /** Слежение за папкой проекта; без него работает только опрос. */
  readonly watcher?: FolderWatcher;
  /** Пауза после последнего события перед перечитыванием: Syncthing пишет файлы пачкой. */
  readonly debounceMs?: number;
  /** Опрос по таймеру (мс); не задан — без опроса. */
  readonly pollMs?: number;
  readonly onRefreshed?: (reports: RefreshReport[]) => void;
  readonly onError?: (error: unknown) => void;
}

export interface LiveSync {
  /** Перечитать сейчас (например, при возвращении приложения из фона). */
  readonly refreshNow: () => Promise<void>;
  readonly stop: () => void;
}

const DEFAULT_DEBOUNCE_MS = 300;

export function startLiveSync(
  refresh: () => Promise<RefreshReport[]>,
  options: LiveSyncOptions = {},
): LiveSync {
  let stopped = false;
  let debounceTimer: ReturnType<typeof setTimeout> | undefined;
  let running: Promise<void> | null = null;
  // Запросы на перечитывание и сколько из них уже учтено: запрос во время перечитывания
  // даёт ещё один проход после него, но несколько таких запросов — только один проход.
  let requested = 0;
  let handled = 0;

  const loop = async (): Promise<void> => {
    while (handled < requested && !stopped) {
      handled = requested;
      try {
        // Не `onRefreshed?.(await refresh())`: без обработчика такая запись не вызвала бы refresh вовсе.
        const reports = await refresh();
        options.onRefreshed?.(reports);
      } catch (error: unknown) {
        options.onError?.(error);
      }
    }
  };

  const run = (): Promise<void> => {
    if (stopped) return Promise.resolve();
    requested += 1;
    running ??= loop().finally(() => {
      running = null;
    });
    return running;
  };

  const schedule = (): void => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => void run(), options.debounceMs ?? DEFAULT_DEBOUNCE_MS);
  };

  const unwatch = options.watcher?.watch('data', schedule);
  const pollTimer =
    options.pollMs === undefined ? undefined : setInterval(() => void run(), options.pollMs);

  return {
    refreshNow: run,
    stop: () => {
      stopped = true;
      clearTimeout(debounceTimer);
      clearInterval(pollTimer);
      unwatch?.();
    },
  };
}
