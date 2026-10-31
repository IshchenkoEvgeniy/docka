import { describe, expect, it } from 'vitest';
import { createMemoryFileSystem } from '../core';
import { ASSETS_DIR, createAssetStore, isAssetName } from './assetStore';

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('файлы проекта', () => {
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

  it('чужие имена и неподдерживаемые типы отклоняются', async () => {
    const store = createAssetStore(createMemoryFileSystem());
    expect(store.get('../project.json').status).toBe('missing');
    expect((await store.put(new Uint8Array([1]), 'application/x-msdownload')).ok).toBe(false);
  });
});
