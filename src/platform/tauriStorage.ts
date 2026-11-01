import { invoke as tauriInvoke, type InvokeArgs, type InvokeOptions } from '@tauri-apps/api/core';
import { listen as tauriListen, type EventCallback, type UnlistenFn } from '@tauri-apps/api/event';
import type { FileSystem, FolderWatcher } from '../core';

/**
 * Хранилище на диске через команды Rust (src-tauri/src/storage). Реализует порты FileSystem и
 * FolderWatcher для одной открытой папки проекта. Бинарные данные идут без JSON (ADR 0002),
 * кроме Android: его WebView не передаёт тело запроса, и запись уходит JSON с base64.
 */

/** Функции Tauri, которые нужны адаптеру; в тестах подменяются. */
export interface TauriBridge {
  readonly invoke: <T>(command: string, args?: InvokeArgs, options?: InvokeOptions) => Promise<T>;
  readonly listen: <T>(event: string, handler: EventCallback<T>) => Promise<UnlistenFn>;
}

export const tauriBridge: TauriBridge = { invoke: tauriInvoke, listen: tauriListen };

const CHANGED_EVENT = 'storage://changed';
const FILE_PRESENT = 1;

interface ChangedPayload {
  readonly root: string;
  readonly paths: readonly string[];
}

/** Ошибка хранилища с кодом из Rust (INVALID_PATH, ROOT_NOT_OPEN, IO…). */
export class StorageError extends Error {
  constructor(
    readonly command: string,
    readonly detail: string,
  ) {
    super(`${command}: ${detail}`);
    this.name = 'StorageError';
  }
}

async function call<T>(
  bridge: TauriBridge,
  command: string,
  args?: InvokeArgs,
  options?: InvokeOptions,
): Promise<T> {
  try {
    return await bridge.invoke<T>(command, args, options);
  } catch (error: unknown) {
    throw new StorageError(command, typeof error === 'string' ? error : String(error));
  }
}

/** Открывает папку проекта и возвращает её канонический путь для остальных вызовов. */
export function openProjectFolder(
  path: string,
  bridge: TauriBridge = tauriBridge,
  create = false,
): Promise<string> {
  return call<string>(bridge, 'storage_open_root', { path, create });
}

/** Служебные папки приложения (вне синхронизации) и папка проектов по умолчанию. */
export type AppFolder = 'settings' | 'backups' | 'projects';

/** Открывает служебную папку приложения (создаёт при необходимости) и возвращает её путь. */
export function openAppFolder(kind: AppFolder, bridge: TauriBridge = tauriBridge): Promise<string> {
  return call<string>(bridge, 'storage_open_app_folder', { kind });
}

/** Android: тело запроса до Rust не доходит, только JSON (см. ipc-protocol.js в Tauri). */
const NEEDS_JSON_BODY = typeof navigator !== 'undefined' && /Android/i.test(navigator.userAgent);
const BASE64_CHUNK = 0x8000;

export function toBase64(data: Uint8Array): string {
  let binary = '';
  for (let start = 0; start < data.length; start += BASE64_CHUNK)
    binary += String.fromCharCode(...data.subarray(start, start + BASE64_CHUNK));
  return btoa(binary);
}

function pathHeaders(root: string, path: string): InvokeOptions {
  return {
    headers: { 'x-doska-root': encodeURIComponent(root), 'x-doska-path': encodeURIComponent(path) },
  };
}

export function createTauriFileSystem(
  root: string,
  bridge: TauriBridge = tauriBridge,
  jsonBody: boolean = NEEDS_JSON_BODY,
): FileSystem {
  const body = (data: Uint8Array): InvokeArgs => (jsonBody ? { base64: toBase64(data) } : data);
  return {
    readFile: async (path) => {
      const response = new Uint8Array(
        await call<ArrayBuffer>(bridge, 'storage_read', { root, path }),
      );
      return response[0] === FILE_PRESENT ? response.slice(1) : null;
    },
    writeFileAtomic: (path, data) =>
      call<undefined>(bridge, 'storage_write_atomic', body(data), pathHeaders(root, path)),
    appendFile: (path, data) =>
      call<undefined>(bridge, 'storage_append', body(data), pathHeaders(root, path)),
    listDir: (path) => call<string[]>(bridge, 'storage_list', { root, path }),
    removeFile: (path) => call<undefined>(bridge, 'storage_remove', { root, path }),
    removeDirectory: (path) => call<undefined>(bridge, 'storage_remove_directory', { root, path }),
    latestChange: (path) => call<number | null>(bridge, 'storage_latest_change', { root, path }),
  };
}

/** Без слежения приложение работает, просто правки с других устройств придут при следующем открытии. */
function reportWatchError(error: unknown): void {
  console.error('Слежение за папкой проекта не запустилось', error);
}

/**
 * Слежение за папкой проекта. Одна подписка на события Rust на все вызовы watch;
 * отписка синхронная, даже если подписка ещё не успела установиться.
 */
export function createTauriFolderWatcher(
  root: string,
  bridge: TauriBridge = tauriBridge,
): FolderWatcher {
  return {
    watch: (path, onChange) => {
      let active = true;
      let unlisten: UnlistenFn | null = null;
      const prefix = path === '' ? '' : `${path}/`;
      bridge
        .listen<ChangedPayload>(CHANGED_EVENT, ({ payload }) => {
          if (!active || payload.root !== root) return;
          const relevant = payload.paths.filter((changed) => changed.startsWith(prefix));
          if (relevant.length > 0) onChange(relevant);
        })
        .then((stop) => {
          if (active) unlisten = stop;
          else stop();
        })
        .catch(reportWatchError);
      call(bridge, 'storage_watch', { root }).catch(reportWatchError);
      return () => {
        active = false;
        unlisten?.();
      };
    },
  };
}
