import { describe, expect, it } from 'vitest';
import * as Y from 'yjs';
import { createManualClock, createSequentialIdGenerator, type BoardId } from '../../core';
import { ensureText, textOf } from '../../data';
import { fullscreenFragment } from './fullscreenText';
import { createBoardModel } from './model';

function setup() {
  const environment = { clock: createManualClock(1), ids: createSequentialIdGenerator('el') };
  const model = createBoardModel(new Y.Doc(), 'board-0001' as BoardId, environment); // корректный id
  const create = (type: string, data: Record<string, unknown>) => {
    const result = model.run({
      kind: 'createElement',
      type,
      placement: { x: 0, y: 0, width: 100, height: 100 },
      data,
    });
    return result?.createdId ?? '';
  };
  const runtime = (fullscreenEditing: boolean) => ({
    fullscreenEditing,
    ensureText: (id: string, initial: Parameters<typeof ensureText>[2]) =>
      ensureText(model.doc, id, initial),
  });
  return { model, create, runtime };
}

describe('правка на весь экран', () => {
  it('у элемента без текста (образец цвета) текст не создаётся', () => {
    const { model, create, runtime } = setup();
    const swatch = create('swatch', { hex: '#4A90D9' });
    expect(fullscreenFragment(model, runtime(true), swatch)).toBeNull();
    expect(textOf(model.doc, swatch)).toBeNull();
  });

  it('на компьютере редактор на весь экран не нужен — текст не трогается', () => {
    const { model, create, runtime } = setup();
    const note = create('note', { text: 'Старая заметка' });
    expect(fullscreenFragment(model, runtime(false), note)).toBeNull();
    expect(textOf(model.doc, note)).toBeNull();
    expect(fullscreenFragment(model, runtime(true), note)).not.toBeNull();
  });
});
