import { describe, expect, it } from 'vitest';
import * as Y from 'yjs';
import {
  createManualClock,
  createSequentialIdGenerator,
  plainToRichText,
  type BoardId,
} from '../../core';
import {
  alignSelection,
  copySelection,
  createNote,
  stopEditing,
  deleteSelection,
  duplicateSelection,
  pastePayload,
  selectAll,
  toggleLockSelection,
} from './boardActions';
import { createGestureHandlers } from './gestureHandlers';
import { createBoardModel } from './model';

function setup() {
  const environment = { clock: createManualClock(1), ids: createSequentialIdGenerator('el') };
  const model = createBoardModel(new Y.Doc(), 'board-0001' as BoardId, environment); // корректный id
  const menus: string[] = [];
  const handlers = createGestureHandlers(model, {
    getCamera: () => ({ offsetX: 0, offsetY: 0, zoom: 1 }),
    getVisibleRect: () => null,
    measure: () => null,
    openMenu: (target) => menus.push(target.kind),
  });
  const note = (x: number, y: number, text: string) => ({
    type: 'note',
    placement: { x, y, width: 240, height: 120 },
    data: {},
    richText: plainToRichText(text),
  });
  model.run({ kind: 'createElements', elements: [note(0, 0, 'а'), note(500, 400, 'б')] });
  model.interaction.setState({ selection: new Set() });
  const [a, b] = [...model.elements.getSnapshot().keys()];
  if (a === undefined || b === undefined) throw new Error('не созданы');
  const selection = () => [...model.interaction.getState().selection];
  const element = (id: string) => model.elements.getSnapshot().get(id);
  return { model, handlers, a, b, selection, element, menus };
}

describe('жесты доски', () => {
  it('перетаскивание: предпросмотр без записи, одна команда в конце, отмена', () => {
    const { model, handlers, a, element } = setup();
    handlers.pressElement(a, false);
    expect(handlers.startMove()).toBe(true);
    handlers.updateMove({ x: 1001, y: 1003 });
    expect(element(a)?.x).toBe(0);
    expect(model.interaction.getState().drag).toMatchObject({ dx: 1001, dy: 1003 });
    handlers.endMove(true);
    expect(element(a)).toMatchObject({ x: 1001, y: 1003 });
    expect(model.interaction.getState().drag).toBeNull();
    model.undo.undo();
    expect(element(a)?.x).toBe(0);
  });

  it('прилипает к краю соседа и к сетке', () => {
    const { model, handlers, a, element } = setup();
    handlers.pressElement(a, false);
    handlers.startMove();
    handlers.updateMove({ x: 503, y: 2000 }); // левый край 503 → 500 (сосед)
    expect(model.interaction.getState().guides).toHaveLength(1);
    model.settings.setState({ gridSnap: true });
    handlers.updateMove({ x: 1010, y: 1013 });
    handlers.endMove(true);
    expect(element(a)).toMatchObject({ x: 1008, y: 1008 });
  });

  it('закреплённое не двигается и не меняет размер', () => {
    const { model, handlers, a } = setup();
    handlers.pressElement(a, false);
    toggleLockSelection(model);
    expect(handlers.startMove()).toBe(false);
    expect(handlers.startResize(a, 'se')).toBe(false);
  });

  it('размер: не меньше минимального, одна команда', () => {
    const { handlers, a, element } = setup();
    handlers.startResize(a, 'se');
    handlers.updateResize({ x: -1000, y: 30 });
    handlers.endResize(true);
    expect(element(a)).toMatchObject({ width: 80, height: 150 });
  });

  it('рамка выделяет пересечённое; с Shift — добавляет к прежнему', () => {
    const { handlers, a, b, selection } = setup();
    handlers.updateMarquee({ x: 600, y: 300, width: 10, height: 300 }, false);
    handlers.endMarquee(true);
    expect(selection()).toEqual([b]);
    handlers.updateMarquee({ x: 0, y: 0, width: 10, height: 10 }, true);
    expect(selection().sort()).toEqual([a, b].sort());
  });

  it('меню на невыделенном элементе выделяет его', () => {
    const { handlers, b, selection, menus } = setup();
    handlers.openMenu({ kind: 'element', id: b }, { x: 0, y: 0 });
    expect(selection()).toEqual([b]);
    expect(menus).toEqual(['element']);
  });
});

describe('действия доски', () => {
  it('выравнивание, дублирование, удаление со сбросом выделения', () => {
    const { model, a, b, element, selection } = setup();
    selectAll(model);
    alignSelection(model, 'top');
    expect(element(b)?.y).toBe(0);
    duplicateSelection(model);
    expect(model.elements.getSnapshot().size).toBe(4);
    expect(selection()).not.toContain(a);
    deleteSelection(model);
    expect(model.elements.getSnapshot().size).toBe(2);
    expect(selection()).toEqual([]);
  });

  it('новая заметка сразу открывается на правку; двойной клик и касание выделенного — тоже', () => {
    const { model, handlers, a } = setup();
    createNote(model, { x: 0, y: 0 });
    expect(model.interaction.getState().editingId).not.toBeNull();
    handlers.clickBackground();
    expect(model.interaction.getState().editingId).toBeNull();
    handlers.pressElement(a, false);
    handlers.releaseElement(a, 'tap'); // первое касание только выделяет
    expect(model.interaction.getState().editingId).toBeNull();
    handlers.pressElement(a, false);
    handlers.releaseElement(a, 'tap');
    expect(model.interaction.getState().editingId).toBe(a);
    stopEditing(model);
    handlers.pressElement(a, false);
    handlers.releaseElement(a, 'doubleClick');
    expect(model.interaction.getState().editingId).toBe(a);
  });

  it('копирование вместе с текстом', () => {
    const { model, a } = setup();
    model.interaction.setState({ selection: new Set([a]) });
    const content = copySelection(model);
    expect(content?.plainText).toBe('а');
    expect(content?.payload.elements[0]?.richText).toHaveLength(1);
  });

  it('копирование и вставка в другую доску', () => {
    const source = setup();
    selectAll(source.model);
    const content = copySelection(source.model);
    if (content === null) throw new Error('пусто');
    const target = setup();
    pastePayload(target.model, content.payload, { x: 0, y: 0 });
    expect(target.model.elements.getSnapshot().size).toBe(4);
    expect(target.selection()).toHaveLength(2);
  });
});
