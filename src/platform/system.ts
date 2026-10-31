import type { FetchedResource, Network } from '../core';
import { tauriBridge, type TauriBridge } from './tauriStorage';

/**
 * Системные операции вне папки проекта (ADR 0005): сеть для превью ссылок (команда Rust
 * net_fetch — из WebView чужие сайты не читаются) и открытие ссылок и файлов в системе.
 */

interface Fetched {
  readonly finalUrl: string;
  readonly contentType: string;
  readonly base64: string;
  readonly truncated: boolean;
}

function fromBase64(encoded: string): Uint8Array {
  return Uint8Array.from(atob(encoded), (char) => char.charCodeAt(0));
}

async function call<T>(bridge: TauriBridge, command: string, args: Record<string, unknown>) {
  try {
    return await bridge.invoke<T>(command, args);
  } catch (error: unknown) {
    throw new Error(typeof error === 'string' ? error : String(error), { cause: error });
  }
}

export function createTauriNetwork(bridge: TauriBridge = tauriBridge): Network {
  return {
    fetch: async (url): Promise<FetchedResource> => {
      const fetched = await call<Fetched>(bridge, 'net_fetch', { url });
      return {
        finalUrl: fetched.finalUrl,
        contentType: fetched.contentType,
        bytes: fromBase64(fetched.base64),
        truncated: fetched.truncated,
      };
    },
  };
}

/** Ссылка — в браузере системы (на Android — через приложение по умолчанию). */
export async function openUrlInSystem(url: string, bridge: TauriBridge = tauriBridge) {
  await call<null>(bridge, 'system_open_url', { url });
}

/** Файл внутри открытой папки — системной программой (компьютер). */
export async function openFileInSystem(
  root: string,
  path: string,
  bridge: TauriBridge = tauriBridge,
): Promise<void> {
  await call<null>(bridge, 'system_open_file', { root, path });
}
