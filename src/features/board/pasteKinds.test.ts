import { describe, expect, it } from 'vitest';
import * as Y from 'yjs';
import {
  createManualClock,
  createMemoryFileSystem,
  createSequentialIdGenerator,
  type BoardId,
  type Network,
} from '../../core';
import { createAssetStore } from '../../data';
import { insertFiles } from './files';
import { NO_HOST } from './host';
import { createBoardModel } from './model';
import { applyPaste, resolvePaste } from './pasting';

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

function setup(network: Network | null = null) {
  const environment = { clock: createManualClock(1), ids: createSequentialIdGenerator('el') };
  const assets = createAssetStore(createMemoryFileSystem());
  const model = createBoardModel(new Y.Doc(), 'board-0001' as BoardId, environment, {
    ...NO_HOST,
    assets,
    network,
  }); // корректный id доски
  const elements = () => [...model.elements.getSnapshot().values()];
  const paste = (text: string) => {
    applyPaste(model, resolvePaste('', text, null), { x: 0, y: 0 });
  };
  return { model, elements, paste };
}

describe('вставка и файлы на доске', () => {
  it('адрес — карточкой ссылки; превью дописывается без шага отмены', async () => {
    const html = '<meta property="og:title" content="Гайд по таверне">';
    const network: Network = {
      fetch: (url) =>
        Promise.resolve({
          finalUrl: url,
          contentType: 'text/html',
          bytes: new TextEncoder().encode(html),
          truncated: false,
        }),
    };
    const { model, elements, paste } = setup(network);
    paste('https://guide.example.com/tavern');
    await settle();
    await settle();
    expect(elements()[0]).toMatchObject({
      type: 'link',
      data: { url: 'https://guide.example.com/tavern', title: 'Гайд по таверне' },
    });
    model.undo.undo();
    expect(elements()).toHaveLength(0);
  });

  it('текст из Excel — таблицей, обычный текст — заметкой', () => {
    const { elements, paste } = setup();
    paste('Имя\tУровень\nБорис\t3');
    paste('Просто мысль');
    expect(elements().map((element) => element.type)).toEqual(['table', 'note']);
  });

  it('файлы: видео — плеером, документ — карточкой файла в assets/', async () => {
    const { elements, model } = setup();
    const files = [
      new File([new Uint8Array([1])], 'интро.mp4', { type: 'video/mp4' }),
      new File([new Uint8Array([2])], 'ГДД.docx', { type: '' }),
    ];
    await insertFiles(model, files, { x: 0, y: 0 });
    expect(elements().map((element) => element.type)).toEqual(['video', 'file']);
    expect(elements()[1]?.data).toMatchObject({ name: 'ГДД.docx', size: 1 });
    expect(String(elements()[1]?.data.asset)).toMatch(/\.docx$/);
  });
});
