import type { Network } from '../../core';
import type { AssetStore } from '../../data';
import { charsetOf, parseLinkMeta } from './meta';

/** Что превью добавляет в данные ссылки; картинка и значок — файлы в assets/ проекта. */
export interface LinkPreview {
  readonly title?: string;
  readonly description?: string;
  readonly siteName?: string;
  readonly image?: string;
  readonly icon?: string;
}

function decode(bytes: Uint8Array, contentType: string): string {
  const guess = new TextDecoder('utf-8').decode(bytes.subarray(0, 4096));
  const charset = charsetOf(contentType, guess);
  try {
    return new TextDecoder(charset).decode(bytes);
  } catch {
    return new TextDecoder('utf-8').decode(bytes);
  }
}

/** Картинка по адресу — в assets/ (превью работает офлайн и доезжает до телефона). */
async function storeImage(
  network: Network,
  assets: AssetStore,
  url: string,
): Promise<string | undefined> {
  try {
    const image = await network.fetch(url);
    const mime = image.contentType.split(';')[0]?.trim().toLowerCase() ?? '';
    if (image.truncated || !mime.startsWith('image/')) return undefined;
    const stored = await assets.put(image.bytes, mime);
    return stored.ok ? stored.value : undefined;
  } catch {
    // Картинки может не быть (404, блокировка) — превью всё равно полезно без неё.
    return undefined;
  }
}

/** Превью страницы: заголовок, описание, сайт, картинка и значок. */
export async function fetchPreview(
  url: string,
  network: Network,
  assets: AssetStore | null,
): Promise<LinkPreview> {
  const page = await network.fetch(url);
  if (!/html/i.test(page.contentType)) return {};
  const meta = parseLinkMeta(decode(page.bytes, page.contentType), page.finalUrl);
  const [image, icon] = await Promise.all([
    meta.image === null || assets === null ? undefined : storeImage(network, assets, meta.image),
    meta.icon === null || assets === null ? undefined : storeImage(network, assets, meta.icon),
  ]);
  return {
    ...(meta.title === null ? {} : { title: meta.title }),
    ...(meta.description === null ? {} : { description: meta.description }),
    ...(meta.siteName === null ? {} : { siteName: meta.siteName }),
    ...(image === undefined ? {} : { image }),
    ...(icon === undefined ? {} : { icon }),
  };
}
