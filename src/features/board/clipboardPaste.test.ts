import { afterEach, describe, expect, it } from 'vitest';
import * as Y from 'yjs';
import {
  createManualClock,
  createMemoryFileSystem,
  createSequentialIdGenerator,
  type BoardId,
  type ClipboardReader,
} from '../../core';
import { createAssetStore } from '../../data';
import { createNote, copySelection } from './boardActions';
import { appClipboard } from './clipboard';
import { clipboardFiles } from './clipboardFiles';
import { NO_HOST } from './host';
import { createBoardModel, type BoardModel } from './model';
import { pasteFromApp } from './pasting';

const models: BoardModel[] = [];
afterEach(() => {
  appClipboard.setState({ content: null, copiedAt: 0 });
  for (const model of models.splice(0)) {
    model.destroy();
    model.doc.destroy();
  }
});

function setup(readClipboard: ClipboardReader) {
  const model = createBoardModel(
    new Y.Doc(),
    'board-0001' as BoardId,
    { clock: createManualClock(1), ids: createSequentialIdGenerator('paste') },
    { ...NO_HOST, assets: createAssetStore(createMemoryFileSystem()), readClipboard },
  ); // корректный id
  models.push(model);
  createNote(model, { x: 0, y: 0 }, 'Старая карточка');
  appClipboard.setState({ content: copySelection(model) });
  return model;
}

describe('вставка системного буфера на доску', () => {
  it('свежая копия карточки из меню важнее старой картинки в Android-буфере', async () => {
    const model = setup(() =>
      Promise.resolve({
        changedAt: 50,
        text: '',
        files: [{ name: 'old.png', mime: 'image/png', bytes: new Uint8Array([1]) }],
      }),
    );
    appClipboard.setState({ copiedAt: 100 });
    await pasteFromApp(model, { x: 100, y: 100 });
    expect([...model.elements.getSnapshot().values()].map((item) => item.type)).toEqual([
      'note',
      'note',
    ]);
  });

  it('новое внешнее изображение вытесняет более старую копию карточки', async () => {
    const model = setup(() =>
      Promise.resolve({
        changedAt: 200,
        text: '',
        files: [{ name: 'new.png', mime: 'image/png', bytes: new Uint8Array([1]) }],
      }),
    );
    appClipboard.setState({ copiedAt: 100 });
    await pasteFromApp(model, { x: 100, y: 100 });
    expect([...model.elements.getSnapshot().values()].map((item) => item.type)).toEqual([
      'note',
      'image',
    ]);
  });
  it('изображение важнее старого внутреннего буфера карточек, вставка отменяется одним шагом', async () => {
    const model = setup(() =>
      Promise.resolve({
        text: '',
        files: [{ name: 'photo.png', mime: 'image/png', bytes: new Uint8Array([1, 2, 3]) }],
      }),
    );
    await pasteFromApp(model, { x: 100, y: 100 });
    expect([...model.elements.getSnapshot().values()].map((item) => item.type)).toEqual([
      'note',
      'image',
    ]);
    model.undo.undo();
    expect(model.elements.getSnapshot().size).toBe(1);
  });

  it('пустой системный буфер не вставляет устаревшую карточку', async () => {
    const model = setup(() => Promise.resolve({ text: '', files: [], changedAt: 100 }));
    await pasteFromApp(model, { x: 100, y: 100 });
    expect(model.elements.getSnapshot().size).toBe(1);
    expect(model.notice.getState().message).not.toBeNull();
  });

  it('сохраняет копирование карточек, если внешний буфер недоступен', async () => {
    const model = setup(() => Promise.reject(new Error('not supported')));
    await pasteFromApp(model, { x: 100, y: 100 });
    expect(model.elements.getSnapshot().size).toBe(2);
  });

  it('WebView: получает файл из items, когда files пуст', () => {
    const file = new File(['image'], 'photo.png', { type: 'image/png' });
    // Нужны только поля, читаемые адаптером DataTransfer.
    const data = {
      files: [],
      items: [{ kind: 'file', getAsFile: () => file }],
    } as unknown as DataTransfer;
    expect(clipboardFiles(data)).toEqual([file]);
  });
});
