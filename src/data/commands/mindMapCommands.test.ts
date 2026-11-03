import { describe, expect, it } from 'vitest';
import * as Y from 'yjs';
import {
  MIND_MAP_LEVEL_GAP,
  buildMindMapForest,
  createManualClock,
  createSequentialIdGenerator,
  type BoardCommand,
  type BoardElement,
  type BoardId,
  type ElementId,
  type NewElement,
} from '../../core';
import { readElements } from '../projectDocument';
import { setMeasuredHeight } from '../richText';
import { executeBoardCommand } from './boardCommands';
import { createUndoHistory } from './undo';

const BOARD = 'board-quests' as BoardId; // тестовая доска

function setup() {
  const doc = new Y.Doc();
  const environment = { clock: createManualClock(100), ids: createSequentialIdGenerator('pc') };
  const run = (command: BoardCommand) => executeBoardCommand(doc, BOARD, command, environment);
  const must = (command: BoardCommand): ElementId => {
    const result = run(command);
    if (!result.ok) throw new Error(result.error);
    return (result.value.createdId ?? '') as ElementId; // id новой карточки
  };
  const note = (
    x = 0,
    y = 0,
    extra: Partial<Extract<BoardCommand, { kind: 'createElement' }>> = {},
  ) =>
    must({
      kind: 'createElement',
      type: 'note',
      placement: { x, y, width: 200, height: 40 },
      data: {},
      ...extra,
    });
  const element = (id: string): BoardElement => {
    const found = readElements(doc).items.find((item) => item.id === id);
    if (found === undefined) throw new Error(`нет ${id}`);
    return found;
  };
  const forest = () => buildMindMapForest(readElements(doc).items);
  const child = (anchorId: ElementId, relation: 'child' | 'sibling' = 'child') =>
    must({
      kind: 'addMindMapNode',
      anchorId,
      relation,
      element: { type: 'note', placement: { x: 0, y: 0, width: 200, height: 40 }, data: {} },
    });
  return { doc, run, must, note, element, forest, child };
}

describe('команды майнд-карты', () => {
  it('корень, ветка и соседняя: раскладка, порядок, цвет родителя, один шаг отмены', () => {
    const { doc, run, note, element, forest, child } = setup();
    const root = note(100, 100, { color: 'blue' });
    expect(run({ kind: 'makeMindMapRoot', elementId: root }).ok).toBe(true);
    const history = createUndoHistory(doc, ['elements', 'connections']);
    const first = child(root);
    const second = child(first, 'sibling');
    const between = child(first, 'sibling');
    expect(forest().nodes.get(root)?.children).toEqual([first, between, second]);
    expect(element(first)).toMatchObject({ x: 100 + 200 + MIND_MAP_LEVEL_GAP, color: 'blue' });
    expect(element(between).y).toBeGreaterThan(element(first).y);
    expect(element(root)).toMatchObject({ x: 100, y: 100 });

    history.undo();
    expect(forest().nodes.get(root)?.children).toEqual([first, second]);
    expect(element(second).y).toBeGreaterThan(element(first).y);
  });

  it('соседняя у корня — тоже ветка; в обе стороны ветки делятся по сторонам', () => {
    const { run, note, forest, child } = setup();
    const root = note();
    run({ kind: 'makeMindMapRoot', elementId: root, direction: 'both' });
    const a = child(root, 'sibling');
    const b = child(root);
    expect(forest().nodes.get(a)?.parentId).toBe(root);
    expect([forest().nodes.get(a)?.link.side, forest().nodes.get(b)?.link.side]).toEqual([
      'right',
      'left',
    ]);
  });

  it('прицепить карточку и узел с веткой; к своей ветке — нельзя', () => {
    const { run, note, forest, child, element } = setup();
    const root = note();
    run({ kind: 'makeMindMapRoot', elementId: root });
    const a = child(root);
    const a1 = child(a);
    const loose = note(5000, 5000);
    expect(run({ kind: 'attachToMindMap', elementIds: [loose], parentId: a1 }).ok).toBe(true);
    expect(forest().nodes.get(loose)?.depth).toBe(3);
    expect(element(loose).x).toBe(element(a1).x + 200 + MIND_MAP_LEVEL_GAP);
    expect(run({ kind: 'attachToMindMap', elementIds: [a], parentId: loose }).ok).toBe(false);
    expect(run({ kind: 'attachToMindMap', elementIds: [a1], parentId: root }).ok).toBe(true);
    expect(forest().nodes.get(loose)?.depth).toBe(2);
  });

  it('карточка из колонки выходит из неё; колонка-карточка не может быть корнем', () => {
    const { run, note, must, element } = setup();
    const column = must({
      kind: 'createElement',
      type: 'column',
      placement: { x: 0, y: 0, width: 280, height: 120 },
      data: {},
    });
    const inColumn = note(0, 0, { parentId: column });
    expect(run({ kind: 'makeMindMapRoot', elementId: inColumn }).ok).toBe(false);
    const root = note(1000, 0);
    run({ kind: 'makeMindMapRoot', elementId: root });
    run({ kind: 'attachToMindMap', elementIds: [inColumn], parentId: root });
    expect(element(inColumn).parentId).toBeNull();
  });

  it('отделить ветку, убрать узел из карты, распустить карту', () => {
    const { run, note, forest, child, element } = setup();
    const root = note();
    run({ kind: 'makeMindMapRoot', elementId: root, direction: 'down' });
    const a = child(root);
    const a1 = child(a);
    const a2 = child(a);
    run({ kind: 'removeFromMindMap', elementId: a });
    expect(element(a).tree).toBeNull();
    expect(forest().nodes.get(root)?.children).toEqual([a1, a2]);

    run({ kind: 'detachMindMapBranch', elementId: a1 });
    expect(forest().roots).toEqual(expect.arrayContaining([root, a1]));
    expect(forest().nodes.get(a1)?.link.direction).toBe('down');

    run({ kind: 'dissolveMindMap', rootId: root });
    expect(forest().nodes.has(root)).toBe(false);
    expect(forest().nodes.has(a2)).toBe(false);
  });

  it('удалить с веткой — в корзину вместе, восстанавливаются вместе', () => {
    const { run, note, forest, child, element } = setup();
    const root = note();
    run({ kind: 'makeMindMapRoot', elementId: root });
    const a = child(root);
    const a1 = child(a);
    const b = child(root);
    const bBefore = element(b).y;
    run({ kind: 'deleteMindMapNode', elementId: a, mode: 'branch' });
    expect(element(a1).deletedAt).not.toBeNull();
    expect(forest().nodes.get(root)?.children).toEqual([b]);
    expect(element(b).y).not.toBe(bBefore);

    run({ kind: 'restoreElements', elementIds: [a] });
    expect(element(a1).deletedAt).toBeNull();
    expect(forest().nodes.get(a)?.children).toEqual([a1]);
  });

  it('удалить только узел — ветки переходят к родителю; только корень — карта распадается', () => {
    const { doc, run, note, forest, child } = setup();
    const root = note();
    run({ kind: 'makeMindMapRoot', elementId: root });
    const a = child(root);
    const a1 = child(a);
    const a2 = child(a);
    const b = child(root);
    run({ kind: 'deleteMindMapNode', elementId: a, mode: 'node' });
    expect(forest().nodes.get(root)?.children).toEqual([a1, a2, b]);
    run({ kind: 'deleteMindMapNode', elementId: root, mode: 'node' });
    expect(forest().nodes.size).toBe(0);
    expect(readElements(doc).items.filter((e) => e.deletedAt === null)).toHaveLength(3);
  });

  it('свернуть, направление, ручной сдвиг; битый сдвиг отклоняется', () => {
    const { run, note, element, child } = setup();
    const root = note();
    run({ kind: 'makeMindMapRoot', elementId: root });
    const a = child(root);
    const b = child(root);
    const bY = element(b).y;
    run({ kind: 'setMindMapCollapsed', elementId: a, collapsed: true });
    expect(element(a).tree?.collapsed).toBe(true);
    run({ kind: 'setMindMapOffset', elementId: b, offset: { dx: 0, dy: 300 } });
    expect(element(b).y).toBe(bY + 300);
    expect(run({ kind: 'setMindMapOffset', elementId: b, offset: { dx: 0, dy: 1e12 } }).ok).toBe(
      false,
    );
    expect(element(b).tree?.offset).toEqual({ dx: 0, dy: 300 });
    expect(run({ kind: 'setMindMapDirection', rootId: a, direction: 'down' }).ok).toBe(false);
    run({ kind: 'setMindMapDirection', rootId: root, direction: 'down' });
    expect(element(a).y).toBeGreaterThan(element(root).y);
  });

  it('перенос: корень везёт карту, узел запоминает сдвиг', () => {
    const { run, note, element, child } = setup();
    const root = note();
    run({ kind: 'makeMindMapRoot', elementId: root });
    const a = child(root);
    const a1 = child(a);
    const before = element(a1);
    run({ kind: 'moveElements', moves: [{ elementId: root, x: 50, y: 70 }] });
    expect(element(a1)).toMatchObject({ x: before.x + 50, y: before.y + 70 });
    run({ kind: 'moveElements', moves: [{ elementId: a, x: element(a).x + 10, y: element(a).y }] });
    expect(element(a).tree?.offset).toEqual({ dx: 10, dy: 0 });
    expect(element(a1).x).toBe(before.x + 60);
  });

  it('узел вырос (замер высоты или ресайз) — карта раскладывается заново', () => {
    const { doc, run, note, element, child } = setup();
    const root = note();
    run({ kind: 'makeMindMapRoot', elementId: root });
    const a = child(root);
    const b = child(root);
    const gap = element(b).y - element(a).y;
    setMeasuredHeight(doc, a, 140);
    expect(element(b).y - element(a).y).toBe(gap + 100);
    run({
      kind: 'resizeElement',
      elementId: a,
      placement: { x: element(a).x, y: element(a).y, width: 200, height: 40 },
    });
    expect(element(b).y - element(a).y).toBe(gap);
  });

  it('пачка новых элементов с местами в карте: дерево, раскладка, один шаг отмены', () => {
    const { doc, run, forest, element } = setup();
    const history = createUndoHistory(doc, ['elements']);
    const spec = (mindMap: NonNullable<NewElement['mindMap']>): NewElement => ({
      type: 'note',
      placement: { x: 500, y: 500, width: 200, height: 40 },
      data: {},
      mindMap,
    });
    const result = run({
      kind: 'createElements',
      elements: [
        spec({ parentIndex: 2, order: 0, collapsed: false }),
        spec({ parentIndex: 2, order: 1, collapsed: false }),
        spec({ order: 0, collapsed: false, direction: 'down' }),
      ],
    });
    if (!result.ok) throw new Error(result.error);
    const [a, b, root] = result.value.createdIds ?? [];
    if (a === undefined || b === undefined || root === undefined) throw new Error('нет id');
    expect(forest().nodes.get(root)?.children).toEqual([a, b]);
    expect(element(a).y).toBeGreaterThan(element(root).y);
    history.undo();
    expect(readElements(doc).items.filter((item) => item.deletedAt === null)).toHaveLength(0);
  });

  it('пачка: несуществующий родитель или узел в колонке — ничего не создаётся', () => {
    const { doc, run } = setup();
    const note = { type: 'note', placement: { x: 0, y: 0, width: 200, height: 40 }, data: {} };
    expect(
      run({
        kind: 'createElements',
        elements: [{ ...note, mindMap: { parentIndex: 5, order: 0, collapsed: false } }],
      }).ok,
    ).toBe(false);
    expect(
      run({
        kind: 'createElements',
        elements: [
          { ...note, type: 'column' },
          { ...note, parentIndex: 0, mindMap: { order: 0, collapsed: false } },
        ],
      }).ok,
    ).toBe(false);
    expect(readElements(doc).items).toHaveLength(0);
  });
});
