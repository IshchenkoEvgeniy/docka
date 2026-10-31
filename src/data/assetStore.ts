import { err, ok, type FileSystem, type Result } from '../core';

/**
 * Файлы проекта (картинки): `assets/<sha256>.<расширение>`. Имя — хэш содержимого, поэтому файл
 * никогда не меняется и конфликтов при синхронизации нет; одинаковые картинки хранятся один раз.
 * Для показа файл читается и превращается в blob-URL (одинаково в Tauri и в браузере).
 */
export const ASSETS_DIR = 'assets';
/** Предел файла (ADR 0005): на Android файл идёт в Rust строкой base64 целиком. */
export const MAX_ASSET_BYTES = 50 * 1024 * 1024;

export const IMAGE_TYPES: Readonly<Record<string, string>> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'image/avif': 'avif',
  'image/bmp': 'bmp',
  'image/svg+xml': 'svg',
  'image/x-icon': 'ico',
  'image/vnd.microsoft.icon': 'ico',
};

/** Видео, звук и документы, у которых расширение важно для показа и открытия в системе. */
export const MEDIA_TYPES: Readonly<Record<string, string>> = {
  'video/mp4': 'mp4',
  'video/webm': 'webm',
  'video/ogg': 'ogv',
  'audio/mpeg': 'mp3',
  'audio/mp4': 'm4a',
  'audio/wav': 'wav',
  'audio/x-wav': 'wav',
  'audio/ogg': 'ogg',
  'audio/webm': 'weba',
  'application/pdf': 'pdf',
};

const KNOWN_TYPES: Readonly<Record<string, string>> = { ...IMAGE_TYPES, ...MEDIA_TYPES };
const MIME_BY_EXTENSION = new Map(Object.entries(KNOWN_TYPES).map(([mime, ext]) => [ext, mime]));
const ASSET_NAME = /^[0-9a-f]{64}\.[a-z0-9]{1,5}$/;

/** Расширение файла в assets/: по типу, иначе из имени файла (латиница и цифры), иначе bin. */
export function assetExtension(mime: string, fileName = ''): string {
  const known = KNOWN_TYPES[mime];
  if (known !== undefined) return known;
  const match = /\.([A-Za-z0-9]{1,5})$/.exec(fileName);
  return match?.[1]?.toLowerCase() ?? 'bin';
}

/** Тип MIME файла из assets/ по расширению (для показа через blob-URL). */
export function assetMime(name: string): string {
  return MIME_BY_EXTENSION.get(name.slice(name.lastIndexOf('.') + 1)) ?? 'application/octet-stream';
}

export function isAssetName(name: string): boolean {
  return ASSET_NAME.test(name);
}

export type AssetState =
  | { readonly status: 'loading' }
  /** Файла нет: ещё не доехал с другого устройства. */
  | { readonly status: 'missing' }
  | { readonly status: 'ready'; readonly url: string };

export interface AssetStore {
  /** Кладёт файл в проект и возвращает его имя; fileName — для расширения неизвестных типов. */
  readonly put: (bytes: Uint8Array, mime: string, fileName?: string) => Promise<Result<string>>;
  /** Состояние файла; первое обращение запускает чтение. */
  readonly get: (name: string) => AssetState;
  readonly subscribe: (listener: () => void) => () => void;
  /** Перечитать отсутствующие файлы (Syncthing мог их привезти). */
  readonly retryMissing: () => void;
  readonly dispose: () => void;
}

async function sha256(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes.slice().buffer);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

const LOADING: AssetState = { status: 'loading' };
const MISSING: AssetState = { status: 'missing' };

/** Пишет файл под именем-хэшем, если такого ещё нет. */
async function writeAsset(
  fs: FileSystem,
  bytes: Uint8Array,
  mime: string,
  fileName: string,
): Promise<Result<string>> {
  const extension = assetExtension(mime, fileName);
  if (bytes.length > MAX_ASSET_BYTES) return err('Файл больше 50 МБ');
  const name = `${await sha256(bytes)}.${extension}`;
  const path = `${ASSETS_DIR}/${name}`;
  if ((await fs.readFile(path)) === null) await fs.writeFileAtomic(path, bytes);
  return ok(name);
}

function revokeAll(states: Map<string, AssetState>): void {
  for (const state of states.values()) if (state.status === 'ready') URL.revokeObjectURL(state.url);
  states.clear();
}

function toState(name: string, bytes: Uint8Array | null): AssetState {
  if (bytes === null) return MISSING;
  const type = assetMime(name);
  return { status: 'ready', url: URL.createObjectURL(new Blob([bytes.slice().buffer], { type })) };
}

export function createAssetStore(fs: FileSystem): AssetStore {
  const states = new Map<string, AssetState>();
  const listeners = new Set<() => void>();
  let disposed = false;
  const settle = (name: string, state: AssetState): void => {
    if (disposed) return;
    states.set(name, state);
    listeners.forEach((listener) => {
      listener();
    });
  };
  const load = (name: string): void => {
    states.set(name, LOADING);
    fs.readFile(`${ASSETS_DIR}/${name}`).then(
      (bytes) => {
        settle(name, toState(name, bytes));
      },
      () => {
        settle(name, MISSING);
      },
    );
  };
  return {
    put: async (bytes, mime, fileName = '') => {
      const stored = await writeAsset(fs, bytes, mime, fileName);
      if (stored.ok && states.get(stored.value)?.status !== 'ready') load(stored.value);
      return stored;
    },
    get: (name) => {
      if (!isAssetName(name)) return MISSING;
      const state = states.get(name);
      if (state !== undefined) return state;
      load(name);
      return LOADING;
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    retryMissing: () => {
      for (const [name, state] of states) if (state.status === 'missing') load(name);
    },
    dispose: () => {
      disposed = true;
      revokeAll(states);
      listeners.clear();
    },
  };
}
