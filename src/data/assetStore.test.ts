import { describe, expect, it } from 'vitest';
import { createMemoryFileSystem } from '../core';
import {
  ASSETS_DIR,
  MAX_ASSET_BYTES,
  assetMime,
  createAssetStore,
  isAssetName,
} from './assetStore';

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('файлы проекта', () => {
  it('любой тип: расширение по типу или из имени файла, иначе bin; предел 50 МБ', async () => {
    const store = createAssetStore(createMemoryFileSystem());
    const put = async (mime: string, name?: string) => {
      const stored = await store.put(new Uint8Array([9]), mime, name);
      return stored.ok ? stored.value.split('.')[1] : stored.error;
    };
    expect(await put('application/pdf')).toBe('pdf');
    expect(await put('application/vnd.openxmlformats', 'План.DOCX')).toBe('docx');
    expect(await put('application/octet-stream', 'без-расширения')).toBe('bin');
    expect(assetMime(`${'0'.repeat(64)}.mp4`)).toBe('video/mp4');
    expect(isAssetName(`${'0'.repeat(64)}.7z`)).toBe(true);
    expect(isAssetName(`${'0'.repeat(64)}.exe/../x`)).toBe(false);
  });

  it('имя — хэш содержимого: одинаковый файл хранится один раз', async () => {
    const fs = createMemoryFileSystem();
    const store = createAssetStore(fs);
    const bytes = new Uint8Array([1, 2, 3]);
    const first = await store.put(bytes, 'image/png');
    const again = await store.put(bytes, 'image/png');
    if (!first.ok || !again.ok) throw new Error('не сохранено');
    expect(first.value).toBe(again.value);
    expect(isAssetName(first.value)).toBe(true);
    expect(first.value).toBe(
      '039058c6f2c0cb492c533b0a4d14ef77cc0f78abccced5287d84a1a2011cfb81.png',
    );
    expect(fs.writtenPaths().filter((path) => path.startsWith(ASSETS_DIR))).toHaveLength(1);
    await settle();
    expect(store.get(first.value).status).toBe('ready');
  });

  it('файл ещё не доехал — «нет», после синхронизации — появляется', async () => {
    const fs = createMemoryFileSystem();
    const store = createAssetStore(fs);
    const name = `${'a'.repeat(64)}.jpg`;
    let changes = 0;
    store.subscribe(() => changes++);
    expect(store.get(name).status).toBe('loading');
    await settle();
    expect(store.get(name).status).toBe('missing');
    fs.putExternal(`${ASSETS_DIR}/${name}`, new Uint8Array([9]));
    store.retryMissing();
    await settle();
    expect(store.get(name).status).toBe('ready');
    expect(changes).toBe(2);
    store.dispose();
  });

  it('чужие имена не читаются, слишком большие файлы не кладутся', async () => {
    const store = createAssetStore(createMemoryFileSystem());
    expect(store.get('../project.json').status).toBe('missing');
    const huge = new Uint8Array(MAX_ASSET_BYTES + 1);
    expect((await store.put(huge, 'application/octet-stream')).ok).toBe(false);
  });
});
