import { describe, expect, it } from 'vitest';
import { createMemoryFileSystem, type Network } from '../../core';
import { createAssetStore } from '../../data';
import { draftFromPastedText } from '../registry';
import { charsetOf, decodeEntities, parseLinkMeta } from './meta';
import { fetchPreview } from './preview';
import { embedUrl, normalizeUrl } from './url';

const PAGE = `<!doctype html><html><head>
<meta charset="utf-8"><title>Запасной заголовок</title>
<meta property="og:title" content="Таверна &laquo;Сытый гусь&raquo;">
<meta name="description" content='Лучший эль &amp; жаркое'>
<meta property="og:site_name" content="Гайд">
<meta property="og:image" content="/img/cover.png">
<link rel="shortcut icon" href="https://cdn.example.com/fav.png">
</head><body></body></html>`;

describe('адреса ссылок', () => {
  it('во вставленном тексте узнаётся одна строка-адрес, схему можно не писать', () => {
    expect(normalizeUrl('https://example.com/a?b=1')).toBe('https://example.com/a?b=1');
    expect(normalizeUrl(' кодекс.рф/игра ')).toMatch(/^https:\/\/xn--[\w-]+\.xn--p1ai\/%D0%B8/);
    expect(normalizeUrl('javascript:alert(1)')).toBeNull();
    expect(normalizeUrl('два слова')).toBeNull();
    expect(normalizeUrl('Таверна')).toBeNull();
    expect(draftFromPastedText('https://example.com')?.type).toBe('link');
  });

  it('встраивание — только по белому списку', () => {
    expect(embedUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=10')).toBe(
      'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ',
    );
    expect(embedUrl('https://youtu.be/dQw4w9WgXcQ')).toBe(
      'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ',
    );
    expect(embedUrl('https://vimeo.com/76979871')).toBe('https://player.vimeo.com/video/76979871');
    expect(embedUrl('https://docs.google.com/document/d/abc_DEF-1/edit')).toBe(
      'https://docs.google.com/document/d/abc_DEF-1/preview',
    );
    expect(embedUrl('https://example.com/video')).toBeNull();
  });
});

describe('превью', () => {
  it('Open Graph важнее <title>, адреса — абсолютные, сущности HTML раскрыты', () => {
    expect(parseLinkMeta(PAGE, 'https://guide.example.com/tavern')).toEqual({
      title: 'Таверна «Сытый гусь»',
      description: 'Лучший эль & жаркое',
      siteName: 'Гайд',
      image: 'https://guide.example.com/img/cover.png',
      icon: 'https://cdn.example.com/fav.png',
    });
    expect(parseLinkMeta('<title>Только заголовок</title>', 'https://a.example/').icon).toBe(
      'https://a.example/favicon.ico',
    );
    expect(decodeEntities('&#1058;&#x435;ст')).toBe('Тест');
    expect(charsetOf('text/html; charset=windows-1251', '')).toBe('windows-1251');
  });

  it('картинка и значок кладутся в assets/, недоступная картинка не мешает', async () => {
    const assets = createAssetStore(createMemoryFileSystem());
    const pages: Record<string, { contentType: string; bytes: Uint8Array }> = {
      'https://guide.example.com/tavern': {
        contentType: 'text/html; charset=utf-8',
        bytes: new TextEncoder().encode(PAGE),
      },
      'https://guide.example.com/img/cover.png': {
        contentType: 'image/png',
        bytes: new Uint8Array([1, 2, 3]),
      },
    };
    const network: Network = {
      fetch: (url) => {
        const page = pages[url];
        if (page === undefined) return Promise.reject(new Error('404'));
        return Promise.resolve({ ...page, finalUrl: url, truncated: false });
      },
    };
    const preview = await fetchPreview('https://guide.example.com/tavern', network, assets);
    expect(preview).toMatchObject({ title: 'Таверна «Сытый гусь»', siteName: 'Гайд' });
    expect(preview.image).toMatch(/^[0-9a-f]{64}\.png$/);
    expect(preview.icon).toBeUndefined();
  });
});
