import { describe, expect, it } from 'vitest';
import * as Y from 'yjs';
import {
  createManualClock,
  createSequentialIdGenerator,
  plainToRichText,
  richTextToPlain,
  type BoardId,
  type RichNode,
} from '../core';
import { createBoardElementsStore } from './boardElements';
import { createUndoHistory, executeBoardCommand, TYPING_MERGE_MS } from './commands';
import { ensureText, fragmentToRich, setMeasuredHeight, textOf } from './richText';

const BOARD = 'board-0001' as BoardId; // корректный id
const env = { clock: createManualClock(1), ids: createSequentialIdGenerator('el') };
const TYPING = Symbol('editor');

const rich: RichNode[] = [
  {
    type: 'element',
    name: 'heading',
    attrs: { level: 2 },
    children: [{ type: 'text', text: 'НПС' }],
  },
  {
    type: 'element',
    name: 'paragraph',
    children: [
      { type: 'text', text: 'Борис ' },
      { type: 'text', text: 'кузнец', marks: { bold: {} } },
    ],
  },
];

function create(doc: Y.Doc, richText?: RichNode[]): string {
  const result = executeBoardCommand(
    doc,
    BOARD,
    {
      kind: 'createElement',
      type: 'note',
      placement: { x: 0, y: 0, width: 200, height: 100 },
      data: {},
      ...(richText === undefined ? {} : { richText }),
    },
    env,
  );
  if (!result.ok || result.value.createdId === undefined) throw new Error('не создан');
  return result.value.createdId;
}

describe('текст элементов в Yjs', () => {
  it('создаётся вместе с элементом и читается обратно без потерь', () => {
    const doc = new Y.Doc();
    const id = create(doc, rich);
    const fragment = textOf(doc, id);
    if (fragment === null) throw new Error('нет текста');
    expect(fragmentToRich(fragment)).toEqual(rich);
    // Запись элемента по-прежнему проходит схему: поле text схеме не мешает.
    expect(createBoardElementsStore(doc).getSnapshot().get(id)?.type).toBe('note');
  });

  it('сливает правки текста с двух устройств', () => {
    const pc = new Y.Doc();
    const id = create(pc, plainToRichText('Таверна'));
    const phone = new Y.Doc();
    Y.applyUpdate(phone, Y.encodeStateAsUpdate(pc));
    const paragraph = (doc: Y.Doc) => textOf(doc, id)?.get(0) as Y.XmlElement;
    (paragraph(pc).get(0) as Y.XmlText).insert(0, 'Старая ');
    (paragraph(phone).get(0) as Y.XmlText).insert(7, ' у моста');
    Y.applyUpdate(phone, Y.encodeStateAsUpdate(pc));
    Y.applyUpdate(pc, Y.encodeStateAsUpdate(phone));
    const fragment = textOf(pc, id);
    expect(fragment && richTextToPlain(fragmentToRich(fragment))).toBe('Старая Таверна у моста');
  });

  it('старой заметке текст создаётся один раз; высота пишется без шага отмены', () => {
    const doc = new Y.Doc();
    const id = create(doc);
    const undo = createUndoHistory(doc, ['elements']);
    expect(textOf(doc, id)).toBeNull();
    const fragment = ensureText(doc, id, plainToRichText('было'));
    expect(ensureText(doc, id, [])).toBe(fragment);
    setMeasuredHeight(doc, id, 180.4);
    expect(createBoardElementsStore(doc).getSnapshot().get(id)?.height).toBe(180);
    expect(undo.canUndo()).toBe(false);
  });

  it('набор текста склеивается в шаг по паузам, но не с командами', async () => {
    const doc = new Y.Doc();
    const id = create(doc, plainToRichText(''));
    const undo = createUndoHistory(doc, ['elements'], { mergeOrigins: [TYPING] });
    const paragraph = textOf(doc, id)?.get(0) as Y.XmlElement;
    const type = (text: string) => {
      doc.transact(() => {
        paragraph.insert(paragraph.length, [new Y.XmlText(text)]);
      }, TYPING);
    };
    type('а');
    type('б');
    executeBoardCommand(
      doc,
      BOARD,
      { kind: 'moveElements', moves: [{ elementId: id as never, x: 9, y: 9 }] },
      env,
    );
    type('в');
    // Yjs берёт время из Date.now напрямую — подменить его таймерами Vitest нельзя.
    await new Promise((resolve) => setTimeout(resolve, TYPING_MERGE_MS + 50));
    type('г');
    const plain = () => richTextToPlain(fragmentToRich(textOf(doc, id) ?? new Y.XmlFragment()));
    expect(plain()).toBe('абвг');
    undo.undo();
    expect(plain()).toBe('абв');
    undo.undo();
    expect(plain()).toBe('аб');
    undo.undo(); // перемещение
    expect(plain()).toBe('аб');
    undo.undo();
    expect(plain()).toBe('');
  });
});
