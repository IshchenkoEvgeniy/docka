/** Адреса ссылок: распознавание во вставленном тексте и встраивание по белому списку (ADR 0005). */

const SCHEME = /^https?:\/\//i;
/** Похоже на адрес без схемы: «example.com/путь». */
const BARE_HOST = /^[\p{L}\d-]+(\.[\p{L}\d-]+)+(:\d+)?(\/\S*)?$/u;

/** Адрес из вставленного текста: одна строка, http/https (схему можно не писать); иначе null. */
export function normalizeUrl(text: string): string | null {
  const value = text.trim();
  if (value === '' || /\s/.test(value) || value.length > 2000) return null;
  const candidate = SCHEME.test(value) ? value : BARE_HOST.test(value) ? `https://${value}` : null;
  if (candidate === null) return null;
  try {
    const url = new URL(candidate);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString() : null;
  } catch {
    return null;
  }
}

export function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

function youtubeId(url: URL): string | null {
  const host = url.hostname.replace(/^(www\.|m\.)/, '');
  if (host === 'youtu.be') return url.pathname.slice(1) || null;
  if (host !== 'youtube.com') return null;
  if (url.pathname === '/watch') return url.searchParams.get('v');
  const match = /^\/(shorts|embed|live)\/([\w-]+)/.exec(url.pathname);
  return match?.[2] ?? null;
}

const ID = /^[\w-]{1,64}$/;

/** Адрес для iframe по белому списку сайтов; null — сайт не встраивается. */
export function embedUrl(raw: string): string | null {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  const youtube = youtubeId(url);
  if (youtube !== null && ID.test(youtube))
    return `https://www.youtube-nocookie.com/embed/${youtube}`;
  const host = url.hostname.replace(/^www\./, '');
  const vimeo = /^\/(\d+)/.exec(url.pathname)?.[1];
  if (host === 'vimeo.com' && vimeo !== undefined) return `https://player.vimeo.com/video/${vimeo}`;
  if (host === 'figma.com' && /^\/(file|design|proto|board)\//.test(url.pathname))
    return `https://embed.figma.com${url.pathname}?embed-host=doska`;
  const google = /^\/(document|spreadsheets|presentation)\/d\/([\w-]+)/.exec(url.pathname);
  if (host === 'docs.google.com' && google?.[1] !== undefined && google[2] !== undefined)
    return `https://docs.google.com/${google[1]}/d/${google[2]}/preview`;
  const track = /^\/album\/(\d+)\/track\/(\d+)/.exec(url.pathname);
  if (host === 'music.yandex.ru' && track?.[1] !== undefined && track[2] !== undefined)
    return `https://music.yandex.ru/iframe/#track/${track[2]}/${track[1]}`;
  return null;
}
