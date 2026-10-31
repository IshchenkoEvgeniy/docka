/**
 * Превью ссылки из HTML страницы: Open Graph, Twitter, <title>, значок (ADR 0005).
 * Без DOM: регулярные выражения по тегам <meta> и <link> в начале страницы.
 */
export interface LinkMeta {
  readonly title: string | null;
  readonly description: string | null;
  readonly siteName: string | null;
  readonly image: string | null;
  readonly icon: string | null;
}

const ENTITIES: Readonly<Record<string, string>> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  laquo: '«',
  raquo: '»',
  mdash: '—',
  ndash: '–',
  hellip: '…',
};

export function decodeEntities(text: string): string {
  return text.replace(/&(#x[\da-f]+|#\d+|[a-z]+);/gi, (whole, code: string) => {
    if (code.startsWith('#x') || code.startsWith('#X'))
      return String.fromCodePoint(Number.parseInt(code.slice(2), 16));
    if (code.startsWith('#')) return String.fromCodePoint(Number(code.slice(1)));
    return ENTITIES[code.toLowerCase()] ?? whole;
  });
}

/** Атрибуты тега: name="value", name='value', name=value. */
function attributes(tag: string): Map<string, string> {
  const result = new Map<string, string>();
  for (const match of tag.matchAll(/([\w:-]+)\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/g)) {
    const name = match[1]?.toLowerCase();
    const value = match[3] ?? match[4] ?? match[5] ?? '';
    if (name !== undefined) result.set(name, decodeEntities(value).trim());
  }
  return result;
}

function clean(value: string | undefined, limit: number): string | null {
  const text = value?.replace(/\s+/g, ' ').trim() ?? '';
  return text === '' ? null : text.slice(0, limit);
}

function absolute(href: string | undefined, base: string): string | null {
  if (href === undefined || href === '') return null;
  try {
    const url = new URL(href, base);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString() : null;
  } catch {
    return null;
  }
}

function metaTags(html: string): Map<string, string> {
  const metas = new Map<string, string>();
  for (const [tag] of html.matchAll(/<meta\b[^>]*>/gi)) {
    const attrs = attributes(tag);
    const key = (attrs.get('property') ?? attrs.get('name'))?.toLowerCase();
    const content = attrs.get('content');
    if (key !== undefined && content !== undefined && !metas.has(key)) metas.set(key, content);
  }
  return metas;
}

function iconHref(html: string): string | undefined {
  for (const [tag] of html.matchAll(/<link\b[^>]*>/gi)) {
    const attrs = attributes(tag);
    const rel = attrs.get('rel')?.toLowerCase().split(/\s+/) ?? [];
    if (rel.includes('icon') || rel.includes('apple-touch-icon')) return attrs.get('href');
  }
  return undefined;
}

export function parseLinkMeta(html: string, baseUrl: string): LinkMeta {
  const metas = metaTags(html);
  const title = decodeEntities(/<title[^>]*>([^<]*)<\/title>/i.exec(html)?.[1] ?? '');
  const pick = (...keys: string[]) => keys.map((key) => metas.get(key)).find(Boolean);
  return {
    title: clean(pick('og:title', 'twitter:title') ?? title, 300),
    description: clean(pick('og:description', 'twitter:description', 'description'), 600),
    siteName: clean(pick('og:site_name', 'application-name'), 100),
    image: absolute(pick('og:image', 'og:image:url', 'twitter:image'), baseUrl),
    icon: absolute(iconHref(html) ?? '/favicon.ico', baseUrl),
  };
}

/** Кодировка страницы из заголовка Content-Type или <meta charset>; по умолчанию UTF-8. */
export function charsetOf(contentType: string, head: string): string {
  const fromHeader = /charset=["']?([\w-]+)/i.exec(contentType)?.[1];
  const fromMeta = /<meta[^>]+charset=["']?([\w-]+)/i.exec(head)?.[1];
  return (fromHeader ?? fromMeta ?? 'utf-8').toLowerCase();
}
