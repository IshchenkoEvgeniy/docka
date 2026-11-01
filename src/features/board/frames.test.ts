import { afterEach, describe, expect, it } from 'vitest';
import * as Y from 'yjs';
import {
  createManualClock,
  createSequentialIdGenerator,
  plainToRichText,
  type BoardId,
  type ElementId,
  type NewElement,
} from '../../core';
import { compareElementLayers, withRegionContents } from '../../elements';
import {
  copySelection,
  createElementAt,
  deleteSelection,
  duplicateSelection,
  nudgeSelection,
} from './boardActions';
import { createGestureHandlers } from './gestureHandlers';
import { createBoardModel, type BoardModel } from './model';
import { expandRegionMoves } from './regionMoves';

const models: BoardModel[] = [];
afterEach(() => {
  for (const model of models.splice(0)) {
    model.destroy();
    model.doc.destroy();
  }
});

const item = (type: string, x: number, y: number, width: number, height: number): NewElement => ({
  type,
  placement: { x, y, width, height },
  data: {},
  richText: plainToRichText(type),
});

function setup() {
  const model = createBoardModel(new Y.Doc(), 'board-0001' as BoardId, {
    clock: createManualClock(1),
    ids: createSequentialIdGenerator('frame'),
  }); // корректный id
  models.push(model);
  const result = model.run({
    kind: 'createElements',
    elements: [
      item('frame', 0, 0, 800, 600),
      item('frame', 40, 40, 300, 300),
      item('note', 60, 80, 200, 120),
      item('note', 750, 500, 200, 120),
      item('column', 400, 80, 300, 400),
      { ...item('note', 0, 16, 240, 120), parentIndex: 4 },
    ],
  });
  const [frame, inner, note, crossing, column, child] = result?.createdIds ?? [];
  if ([frame, inner, note, crossing, column, child].some((id) => id === undefined))
    throw new Error('Не созданы элементы');
  // Созданные id проверены выше, приведение нужно для команд с брендированными id.
  const ids = (result?.createdIds ?? []) as ElementId[];
  const get = (index: number) => model.elements.getSnapshot().get(ids[index] ?? '');
  const select = (...indices: number[]) => {
    model.interaction.setState({ selection: new Set(indices.map((i) => ids[i] ?? '')) });
  };
  const handlers = createGestureHandlers(model, {
    getCamera: () => ({ offsetX: 0, offsetY: 0, zoom: 1 }),
    getVisibleRect: () => null,
    measure: () => null,
    openMenu: () => undefined,
  });
  return { model, ids, get, select, handlers };
}

describe('рамки холста', () => {
  it('выделение карточек внутри зоны не захватывает рамку; обведение всей зоны захватывает', () => {
    const { model, ids, handlers } = setup();
    handlers.updateMarquee({ x: 55, y: 75, width: 210, height: 130 }, false);
    handlers.endMarquee(true);
    expect(model.interaction.getState().selection).toEqual(new Set([ids[2]]));
    handlers.updateMarquee({ x: -10, y: -10, width: 820, height: 620 }, false);
    handlers.endMarquee(true);
    expect(model.interaction.getState().selection.has(ids[0] ?? '')).toBe(true);
  });
  it('берёт целиком охваченные элементы, вложенную рамку и колонку без её локальных детей', () => {
    const { model, ids } = setup();
    const all = model.elements.getSnapshot();
    const selected = [...all.values()].filter((element) => element.id === ids[0]);
    expect(withRegionContents(all, selected).map((element) => element.id)).toEqual([
      ids[0],
      ids[1],
      ids[2],
      ids[4],
    ]);
    expect(
      [...all.values()]
        .sort(compareElementLayers)
        .slice(0, 2)
        .map((element) => element.id),
    ).toEqual([ids[0], ids[1]]);
  });

  it('переносит зону с содержимым один раз, отменяет и повторяет одним шагом', () => {
    const { model, ids, get, select, handlers } = setup();
    select(0, 1, 2, 5);
    expect(handlers.startMove()).toBe(true);
    handlers.updateMove({ x: 1001, y: 1003 });
    expect(model.interaction.getState().drag?.ids).toEqual(
      new Set([ids[0], ids[1], ids[2], ids[4]]),
    );
    expect(get(2)?.x).toBe(60);
    handlers.endMove(true);
    expect(get(0)).toMatchObject({ x: 1001, y: 1003, parentId: null });
    expect(get(2)).toMatchObject({ x: 1061, y: 1083, parentId: null });
    expect(get(4)).toMatchObject({ x: 1401, y: 1083 });
    expect(get(5)).toMatchObject({ x: 0, y: 16, parentId: ids[4] });
    expect(get(3)).toMatchObject({ x: 750, y: 500 });
    model.undo.undo();
    expect(get(0)?.x).toBe(0);
    expect(get(2)?.x).toBe(60);
    model.undo.redo();
    expect(get(2)?.x).toBe(1061);
  });

  it('отмена жеста и изменение размера не сдвигают карточки; размер меняет будущий состав зоны', () => {
    const { model, get, select, handlers, ids } = setup();
    select(0);
    handlers.startMove();
    handlers.updateMove({ x: 1000, y: 1000 });
    handlers.endMove(false);
    expect(get(2)?.x).toBe(60);
    handlers.startResize(ids[0] ?? '', 'se');
    handlers.updateResize({ x: 400, y: 200 });
    handlers.endResize(true);
    expect(get(2)?.x).toBe(60);
    nudgeSelection(model, 10, 20);
    expect(get(3)).toMatchObject({ x: 760, y: 520 });
  });

  it('фиксирует участников в начале перетаскивания', () => {
    const { model, get, select, handlers } = setup();
    select(0);
    handlers.startMove();
    const created = model.run({
      kind: 'createElement',
      ...item('note', 100, 100, 80, 80),
    })?.createdId;
    handlers.updateMove({ x: 1000, y: 1000 });
    handlers.endMove(true);
    expect(model.elements.getSnapshot().get(created ?? '')?.x).toBe(100);
    expect(get(2)?.x).toBe(1060);
  });

  it('клавиатура не удваивает перенос при выделении рамки и её карточки', () => {
    const { model, get, select } = setup();
    select(0, 1, 2);
    nudgeSelection(model, 16, -16);
    expect(get(2)).toMatchObject({ x: 76, y: 64 });
    expect(get(1)).toMatchObject({ x: 56, y: 24 });
    model.undo.undo();
    expect(get(2)?.x).toBe(60);
  });

  it('совместно выбранная карточка чужой колонки выходит на холст при переносе рамки', () => {
    const { model, ids } = setup();
    const result = model.run({
      kind: 'createElements',
      elements: [
        item('column', 2000, 0, 300, 400),
        { ...item('note', 0, 16, 240, 120), parentIndex: 0 },
      ],
    });
    const child = result?.createdIds?.[1];
    if (child === undefined) throw new Error('Нет карточки');
    model.interaction.setState({ selection: new Set([ids[0] ?? '', child]) });
    const handlers = createGestureHandlers(model, {
      getCamera: () => ({ offsetX: 0, offsetY: 0, zoom: 1 }),
      getVisibleRect: () => null,
      measure: (id) => (id === child ? { x: 2020, y: 80, width: 240, height: 120 } : null),
      openMenu: () => undefined,
    });
    handlers.startMove();
    handlers.updateMove({ x: 1001, y: 1003 });
    handlers.endMove(true);
    expect(model.elements.getSnapshot().get(child)).toMatchObject({
      x: 3021,
      y: 1083,
      parentId: null,
    });
    model.undo.undo();
    expect(model.elements.getSnapshot().get(child)).toMatchObject({
      x: 0,
      y: 16,
      parentId: result?.createdIds?.[0],
    });
  });

  it('закреплённое содержимое блокирует всю операцию без частичной записи', () => {
    const { model, ids, get, select, handlers } = setup();
    model.run({ kind: 'updateElements', elementIds: ids.slice(2, 3), changes: { locked: true } });
    select(0);
    expect(handlers.startMove()).toBe(false);
    expect(model.notice.getState().message).toContain('закреплённые');
    nudgeSelection(model, 10, 10);
    expect(get(0)?.x).toBe(0);
    expect(get(1)?.x).toBe(40);
  });

  it('копия включает содержимое и детей колонок; удаление рамки оставляет их на доске', () => {
    const { model, get, select } = setup();
    select(0);
    const payload = copySelection(model)?.payload;
    expect(payload?.elements).toHaveLength(5);
    expect(payload?.elements[4]?.parentIndex).toBe(3);
    duplicateSelection(model);
    expect(model.elements.getSnapshot().size).toBe(11);
    model.undo.undo();
    select(0);
    deleteSelection(model);
    expect(model.elements.getSnapshot().size).toBe(5);
    expect(get(2)).toBeDefined();
    expect(get(5)).toBeDefined();
  });

  it('рамку нельзя создать внутри колонки', () => {
    const { model, ids } = setup();
    const columnId = ids[4];
    if (columnId === undefined) throw new Error('Нет колонки');
    createElementAt(model, 'frame', { x: 500, y: 500 }, '', { columnId, order: 20 });
    const id = [...model.interaction.getState().selection][0];
    expect(model.elements.getSnapshot().get(id ?? '')?.parentId).toBeNull();
  });

  it('выравнивание пересекающихся зон назначает участнику только один сдвиг', () => {
    const { model, ids, get } = setup();
    const a = ids[0],
      b = ids[1];
    if (a === undefined || b === undefined) throw new Error('Нет рамок');
    const moves = expandRegionMoves(model.elements.getSnapshot(), [
      { id: a, x: 100, y: 0 },
      { id: b, x: 500, y: 40 },
    ]);
    expect(moves.find((move) => move.id === ids[2])?.x).toBe((get(2)?.x ?? 0) + 100);
    expect(moves.map((move) => move.id).length).toBe(new Set(moves.map((move) => move.id)).size);
  });
});
