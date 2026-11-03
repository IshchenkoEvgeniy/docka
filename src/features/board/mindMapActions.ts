import type { Point } from '../../canvas';
import {
  branchOf,
  compareStacking,
  plainToRichText,
  type BoardElement,
  type ElementId,
  type MindMapNode,
  type NewElement,
  type OutlineItem,
} from '../../core';
import { definitionFor } from '../../elements';
import { t } from '../../i18n';
import type { BoardModel } from './model';
import type { MindMapSnapshot } from './mindMapView';

/**
 * Действия майнд-карты (ADR 0011). Модуль не зависит от boardActions: тот вызывает
 * отсюда выбор режима удаления.
 */

/** Узел карты по id (только видимый на доске). */
export function mindMapNode(model: BoardModel, id: string): MindMapNode | null {
  if (!model.elements.getSnapshot().has(id)) return null;
  return model.mindMaps.getSnapshot().forest.nodes.get(id) ?? null;
}

/** Единственный выделенный узел карты или null. */
export function selectedMindMapNode(model: BoardModel): MindMapNode | null {
  const [only, ...rest] = model.interaction.getState().selection;
  return only === undefined || rest.length > 0 ? null : mindMapNode(model, only);
}

/** Может ли карточка стать узлом: зоны (рамки) — нет. */
export function canJoinMindMap(element: BoardElement): boolean {
  return !definitionFor(element.type).region;
}

function editNew(model: BoardModel, id: string): void {
  model.markForMeasure([id]);
  model.interaction.setState({ selection: new Set([id]), editingId: id });
}

/** Новая пустая заметка — ветка (child) или соседняя; сразу открывается на правку. */
export function addMindMapBranch(
  model: BoardModel,
  anchorId: string,
  relation: 'child' | 'sibling',
): void {
  const note = definitionFor('note');
  const result = model.run({
    kind: 'addMindMapNode',
    anchorId: anchorId as ElementId, // id узла из снимка доски
    relation,
    element: {
      type: note.type,
      placement: { x: 0, y: 0, ...note.defaultSize },
      data: note.createData(),
      richText: plainToRichText(''),
    },
  });
  if (result?.createdId !== undefined) editNew(model, result.createdId);
}

/** Новая карта из панели: заметка «Центральная идея» центром в точке — одним шагом отмены. */
export function createMindMap(model: BoardModel, at: Point): void {
  const note = definitionFor('note');
  model.undo.batch(() => {
    const created = model.run({
      kind: 'createElement',
      type: note.type,
      placement: {
        x: Math.round(at.x - note.defaultSize.width / 2),
        y: Math.round(at.y - note.defaultSize.height / 2),
        ...note.defaultSize,
      },
      data: note.createData(),
      richText: plainToRichText(t('mindMap.newRoot')),
    });
    const id = created?.createdId;
    if (id === undefined) return;
    model.run({ kind: 'makeMindMapRoot', elementId: id as ElementId }); // id новой заметки
    model.markForMeasure([id]);
    model.interaction.setState({ selection: new Set([id]) });
  });
}

/** Карточки, брошенные на узел, становятся его ветками. */
export function attachToMindMap(model: BoardModel, ids: readonly string[], parentId: string): void {
  const elements = model.elements.getSnapshot();
  const joining = ids.filter((id) => {
    const element = elements.get(id);
    return element !== undefined && canJoinMindMap(element) && id !== parentId;
  });
  if (joining.length === 0) return;
  model.run({
    kind: 'attachToMindMap',
    elementIds: joining as ElementId[], // id из снимка доски
    parentId: parentId as ElementId,
  });
  model.markForMeasure(joining);
}

/** Перекрасить ветку целиком цветом узла. */
export function colorMindMapBranch(model: BoardModel, nodeId: string): void {
  const color = model.elements.getSnapshot().get(nodeId)?.color;
  if (color === undefined) return;
  const ids = branchOf(model.mindMaps.getSnapshot().forest, nodeId);
  model.run({ kind: 'updateElements', elementIds: ids as ElementId[], changes: { color } }); // узлы доски
}

/**
 * Удаление выделенного с узлами, у которых есть ветки: сначала вопрос «с ветками или только
 * узел» (решение пользователя в проекте майнд-карты). true — открыт вопрос, удалять не нужно.
 */
export function askMindMapDelete(model: BoardModel, elements: readonly BoardElement[]): boolean {
  const withBranches = elements.filter(
    (element) => (mindMapNode(model, element.id)?.children.length ?? 0) > 0,
  );
  if (withBranches.length === 0) return false;
  model.overlay.setState({
    dialog: { kind: 'mindMapDelete', elementIds: elements.map((element) => element.id) },
  });
  return true;
}

/** Ответ на вопрос об удалении: одним шагом отмены. */
export function deleteWithMindMaps(
  model: BoardModel,
  elementIds: readonly string[],
  mode: 'branch' | 'node',
): void {
  if (mode === 'branch') {
    model.run({ kind: 'deleteElements', elementIds: elementIds as ElementId[] }); // id выделенного
    return;
  }
  model.undo.batch(() => {
    const plain: string[] = [];
    for (const id of elementIds) {
      if ((mindMapNode(model, id)?.children.length ?? 0) > 0)
        model.run({ kind: 'deleteMindMapNode', elementId: id as ElementId, mode: 'node' });
      else plain.push(id);
    }
    if (plain.length > 0) model.run({ kind: 'deleteElements', elementIds: plain as ElementId[] });
  });
}

/**
 * Значок панели брошен на узел: созданная карточка становится его веткой, одним шагом отмены.
 * Карточки, которые создаются после окна выбора (картинка, ссылка), ложатся рядом.
 */
export function placeOnMindMapNode(model: BoardModel, nodeId: string, place: () => void): void {
  model.undo.batch(() => {
    const before = new Set(model.elements.getSnapshot().keys());
    place();
    const created = [...model.elements.getSnapshot().keys()].filter((id) => !before.has(id));
    if (created.length === 1) attachToMindMap(model, created, nodeId);
  });
}

/** Узлы берутся вместе с ветками, включая свёрнутые (копирование, дублирование). */
export function withMindMapBranches(
  maps: MindMapSnapshot,
  selected: readonly BoardElement[],
): BoardElement[] {
  if (maps.forest.nodes.size === 0) return [...selected];
  const ids = new Set<string>(selected.map((element) => element.id));
  const extra: BoardElement[] = [];
  for (const element of selected) {
    if (!maps.forest.nodes.has(element.id)) continue;
    for (const id of branchOf(maps.forest, element.id)) {
      const found = maps.elements.get(id);
      if (ids.has(id) || found === undefined) continue;
      ids.add(id);
      extra.push(found);
    }
  }
  return [...selected, ...extra].sort(compareStacking);
}

/** Пункты списка → новая карта центром корня в точке; несколько верхних пунктов — общий корень. */
export function createMindMapFromOutline(
  model: BoardModel,
  items: readonly OutlineItem[],
  at: Point,
): void {
  const note = definitionFor('note');
  const roots: readonly OutlineItem[] =
    items.length === 1 ? items : [{ text: t('mindMap.newMap'), children: items }];
  const elements: NewElement[] = [];
  const add = (item: OutlineItem, parentIndex: number | undefined, order: number): void => {
    const index = elements.length;
    elements.push({
      type: note.type,
      placement: {
        x: Math.round(at.x - note.defaultSize.width / 2),
        y: Math.round(at.y - note.defaultSize.height / 2),
        ...note.defaultSize,
      },
      data: note.createData(),
      richText: plainToRichText(item.text),
      mindMap: {
        order,
        collapsed: false,
        ...(parentIndex === undefined ? { direction: 'right' as const } : { parentIndex }),
      },
    });
    item.children.forEach((child, childOrder) => {
      add(child, index, childOrder);
    });
  };
  roots.forEach((root, order) => {
    add(root, undefined, order);
  });
  const created = model.run({ kind: 'createElements', elements });
  const ids = created?.createdIds ?? [];
  model.markForMeasure(ids);
  if (ids[0] !== undefined) model.interaction.setState({ selection: new Set([ids[0]]) });
}
