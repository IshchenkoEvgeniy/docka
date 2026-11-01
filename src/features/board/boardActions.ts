import {
  EMPTY_SELECTION,
  GRID_SIZE,
  align,
  distribute,
  type AlignMode,
  type DistributeAxis,
  type Point,
  type Size,
} from '../../canvas';
import {
  compareStacking,
  plainToRichText,
  type BoardElement,
  type BoardId,
  type ConnectionId,
  type ConnectionStyle,
  type ElementId,
} from '../../core';
import {
  compareInColumn,
  definitionFor,
  draftFromPastedText,
  type ElementDraft,
  withRegionContents,
} from '../../elements';
import { enrichElement } from './enrich';
import { t } from '../../i18n';
import {
  copyContent,
  placePayload,
  type ClipboardContent,
  type ClipboardPayload,
} from './clipboard';
import type { BoardModel } from './model';
import { placeElements } from './references';
import { runMoves } from './runMoves';

/**
 * Действия над доской. Одно действие = одна команда = один шаг отмены.
 * Их вызывают горячие клавиши, меню, панель инструментов и жесты — логика в одном месте.
 */

/** Выделенные элементы снизу вверх по наложению. */
export function selectedElements(model: BoardModel): BoardElement[] {
  const snapshot = model.elements.getSnapshot();
  const { selection } = model.interaction.getState();
  return [...selection]
    .map((id) => snapshot.get(id))
    .filter((element): element is BoardElement => element !== undefined)
    .sort(compareStacking);
}

const ids = (elements: readonly BoardElement[]): ElementId[] =>
  elements.map((element) => element.id);
const unlocked = (elements: readonly BoardElement[]) =>
  elements.filter((element) => !element.locked);

function select(model: BoardModel, selection: Iterable<string>): void {
  model.interaction.setState({ selection: new Set(selection) });
}

/** Правка текста элемента. */
export function startEditing(model: BoardModel, elementId: string): void {
  const element = model.elements.getSnapshot().get(elementId);
  if (element === undefined || element.locked || definitionFor(element.type).activate !== 'edit')
    return;
  model.interaction.setState({ selection: new Set([elementId]), editingId: elementId });
}

/**
 * Двойной щелчок, касание выделенного, Enter: заметку — править, картинку — открыть
 * на весь экран, карточку доски — войти в доску.
 */
export function activateElement(model: BoardModel, elementId: string): void {
  const element = model.elements.getSnapshot().get(elementId);
  if (element === undefined) return;
  const activation = definitionFor(element.type).activate;
  if (activation === 'edit') startEditing(model, elementId);
  else if (activation === 'view') model.overlay.setState({ viewingId: elementId });
  else if (activation === 'open') openTarget(model, element);
}

/** Войти в доску или открыть сущность — что задаёт тип элемента. */
export function openTarget(model: BoardModel, element: BoardElement): void {
  const target = definitionFor(element.type).target(element);
  if (target?.kind === 'board')
    model.host.openBoard(target.id as BoardId); // id проверен схемой элемента
  else if (target?.kind === 'entity') model.host.openEntity(target.id);
}

export function stopEditing(model: BoardModel): void {
  const { editingId } = model.interaction.getState();
  if (editingId === null) return;
  model.markForMeasure([editingId]);
  model.interaction.setState({ editingId: null });
}

/** Enter: править выделенный элемент, если он один и с текстом. */
export function editSelection(model: BoardModel): void {
  const [only, ...rest] = model.interaction.getState().selection;
  if (only !== undefined && rest.length === 0) activateElement(model, only);
}

export function selectAll(model: BoardModel): void {
  select(model, model.elements.getSnapshot().keys());
}

export function clearSelection(model: BoardModel): void {
  stopEditing(model);
  model.interaction.setState({ selection: EMPTY_SELECTION, connectionSelection: EMPTY_SELECTION });
}

/** Изменение стрелки (вид линии, наконечники, подпись, цвет). */
export function updateConnection(
  model: BoardModel,
  connectionId: string,
  changes: ConnectionStyle,
): void {
  model.run({ kind: 'updateConnection', connectionId: connectionId as ConnectionId, changes });
}

export function deleteSelection(model: BoardModel): void {
  const { connectionSelection } = model.interaction.getState();
  if (connectionSelection.size > 0) {
    model.run({
      kind: 'deleteConnections',
      connectionIds: [...connectionSelection] as ConnectionId[], // id из снимка стрелок
    });
    model.interaction.setState({ connectionSelection: EMPTY_SELECTION });
  }
  const selected = selectedElements(model);
  if (selected.length === 0) return;
  model.run({ kind: 'deleteElements', elementIds: ids(selected) });
}

export function reorderSelection(model: BoardModel, to: 'front' | 'back'): void {
  const selected = selectedElements(model);
  if (selected.length > 0) model.run({ kind: 'reorderElements', elementIds: ids(selected), to });
}

/** Если среди выделенного есть незакреплённые — закрепить всё, иначе открепить. */
export function toggleLockSelection(model: BoardModel): void {
  const selected = selectedElements(model);
  if (selected.length === 0) return;
  const locked = selected.some((element) => !element.locked);
  model.run({ kind: 'updateElements', elementIds: ids(selected), changes: { locked } });
}

const placed = (elements: readonly BoardElement[]) =>
  elements.map((element) => ({ id: element.id, rect: element }));

export function alignSelection(model: BoardModel, mode: AlignMode): void {
  runMoves(model, align(placed(unlocked(selectedElements(model))), mode));
}

export function distributeSelection(model: BoardModel, axis: DistributeAxis): void {
  runMoves(model, distribute(placed(unlocked(selectedElements(model))), axis));
}

/** Сдвиг стрелками: на 1, с Shift — на шаг сетки. */
export function nudgeSelection(model: BoardModel, dx: number, dy: number): void {
  runMoves(
    model,
    unlocked(selectedElements(model)).map((element) => ({
      id: element.id,
      x: element.x + dx,
      y: element.y + dy,
    })),
  );
}

/** Выделенное вместе с карточками выделенных колонок (они идут сразу за своей колонкой). */
function withChildren(model: BoardModel, selected: readonly BoardElement[]): BoardElement[] {
  const all = [...model.elements.getSnapshot().values()];
  const ids = new Set(selected.map((element) => element.id));
  const result: BoardElement[] = [];
  for (const element of selected) {
    if (element.parentId !== null && ids.has(element.parentId)) continue;
    result.push(element);
    if (definitionFor(element.type).container)
      result.push(...all.filter((child) => child.parentId === element.id).sort(compareInColumn));
  }
  return result;
}

export function copySelection(model: BoardModel): ClipboardContent | null {
  const selected = withRegionContents(model.elements.getSnapshot(), selectedElements(model));
  return copyContent(withChildren(model, selected), model.richTextOf);
}

/** ask — спросить «ссылка или копия», если вставляются представления сущностей. */
export function pastePayload(
  model: BoardModel,
  payload: ClipboardPayload,
  center: Point,
  ask = true,
): void {
  placeElements(model, placePayload(payload, center), ask);
}

/** Копия выделенного со сдвигом на шаг сетки — поверх остальных. */
export function duplicateSelection(model: BoardModel): void {
  const content = copySelection(model);
  if (content === null) return;
  const elements = content.payload.elements.map((element) => ({
    type: element.type,
    placement: {
      x: element.x + GRID_SIZE,
      y: element.y + GRID_SIZE,
      width: element.width,
      height: element.height,
    },
    color: element.color,
    tagIds: element.tagIds,
    data: element.data,
    ...(element.richText === undefined ? {} : { richText: element.richText }),
    ...(element.parentIndex === undefined ? {} : { parentIndex: element.parentIndex }),
  }));
  placeElements(model, elements, true);
}

/** Место в колонке: карточку бросили на колонку (order — ключ порядка, поле y карточки). */
export interface ColumnSlot {
  readonly columnId: ElementId;
  readonly order: number;
}

/** Центром в точке на доске или в колонку (там x не нужен, y — порядок). */
function placementAt(size: Size, center: Point, slot: ColumnSlot | null) {
  if (slot !== null)
    return { placement: { x: 0, y: slot.order, ...size }, parentId: slot.columnId };
  return {
    placement: {
      x: Math.round(center.x - size.width / 2),
      y: Math.round(center.y - size.height / 2),
      ...size,
    },
  };
}

/**
 * Новый элемент центром в точке (кнопка, горячая клавиша, вставка текста) или в колонку.
 * Пустой элемент с текстом сразу открывается на правку.
 */
export function createElementAt(
  model: BoardModel,
  type: string,
  center: Point,
  text = '',
  slot: ColumnSlot | null = null,
): void {
  const definition = definitionFor(type);
  // Контейнер в контейнер не кладётся.
  const where = placementAt(
    definition.defaultSize,
    center,
    definition.container || definition.region ? null : slot,
  );
  const result = model.run({
    kind: 'createElement',
    type: definition.type,
    ...where,
    data: definition.createData(),
    ...(definition.richText ? { richText: plainToRichText(text) } : {}),
  });
  const id = result?.createdId;
  if (id === undefined) return;
  model.markForMeasure([id]);
  if (text === '' && definition.editOnCreate) startEditing(model, id);
  else select(model, [id]);
}

/** Карточка новой вложенной доски в точке (или в колонке); сразу предлагается название. */
export function createBoardCard(
  model: BoardModel,
  center: Point,
  slot: ColumnSlot | null = null,
): void {
  const boardId = model.host.createBoard();
  if (boardId === null) {
    model.showNotice(t('board.notice.noProjectBoards'));
    return;
  }
  const definition = definitionFor('board');
  const result = model.run({
    kind: 'createElement',
    type: definition.type,
    ...placementAt(definition.defaultSize, center, slot),
    data: { boardId },
  });
  if (result?.createdId === undefined) return;
  select(model, [result.createdId]);
  model.host.renameBoard(boardId);
}

export function createNote(
  model: BoardModel,
  center: Point,
  text = '',
  slot: ColumnSlot | null = null,
): void {
  createElementAt(model, 'note', center, text, slot);
}

/** Элемент из распознанного текста (таблица из Excel) центром в точке. */
export function createDraft(
  model: BoardModel,
  type: string,
  draft: ElementDraft,
  center: Point,
): void {
  const result = model.run({
    kind: 'createElement',
    type,
    placement: {
      x: Math.round(center.x - draft.width / 2),
      y: Math.round(center.y - draft.height / 2),
      width: draft.width,
      height: draft.height,
    },
    data: draft.data,
  });
  if (result?.createdId === undefined) return;
  model.markForMeasure([result.createdId]);
  select(model, [result.createdId]);
  if (definitionFor(type).enrich !== null) void enrichElement(model, result.createdId);
}

/** Элемент из текста, если его узнаёт какой-то тип (ссылка, таблица); false — не узнал. */
export function createFromText(model: BoardModel, text: string, center: Point): boolean {
  const recognized = draftFromPastedText(text);
  if (recognized === null) return false;
  createDraft(model, recognized.type, recognized.draft, center);
  return true;
}

/** Библиотека сущностей проекта (там сущность создают и кладут на доску). */
export function openLibrary(model: BoardModel): void {
  const entities = model.host.entities;
  if (entities === null) model.showNotice(t('board.notice.noProjectEntities'));
  else entities.openLibrary();
}
