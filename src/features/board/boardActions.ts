import {
  EMPTY_SELECTION,
  GRID_SIZE,
  align,
  distribute,
  type AlignMode,
  type DistributeAxis,
  type Move,
  type Point,
} from '../../canvas';
import {
  compareStacking,
  plainToRichText,
  type BoardElement,
  type BoardId,
  type CommandResult,
  type ConnectionId,
  type ConnectionStyle,
  type ElementId,
} from '../../core';
import { compareInColumn, definitionFor } from '../../elements';
import { t } from '../../i18n';
import {
  copyContent,
  placePayload,
  type ClipboardContent,
  type ClipboardPayload,
} from './clipboard';
import type { BoardModel } from './model';

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

function selectCreated(model: BoardModel, result: CommandResult | null): void {
  if (result?.createdIds !== undefined) select(model, result.createdIds);
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
  else if (activation === 'open' && typeof element.data.boardId === 'string')
    model.host.openBoard(element.data.boardId as BoardId); // id доски проверен схемой элемента
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

function runMoves(model: BoardModel, moves: readonly Move[]): void {
  if (moves.length === 0) return;
  model.run({
    kind: 'moveElements',
    moves: moves.map((move) => ({ elementId: move.id as ElementId, x: move.x, y: move.y })), // id из снимка доски
  });
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
  return copyContent(withChildren(model, selectedElements(model)), model.richTextOf);
}

export function pastePayload(model: BoardModel, payload: ClipboardPayload, center: Point): void {
  const elements = placePayload(payload, center);
  if (elements.length > 0) selectCreated(model, model.run({ kind: 'createElements', elements }));
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
  selectCreated(model, model.run({ kind: 'createElements', elements }));
}

/**
 * Новый элемент центром в точке (кнопка, горячая клавиша, вставка текста).
 * Пустой элемент с текстом сразу открывается на правку.
 */
export function createTextElement(
  model: BoardModel,
  type: 'note' | 'title' | 'column' | 'checklist',
  center: Point,
  text = '',
): void {
  const definition = definitionFor(type);
  const { width, height } = definition.defaultSize;
  const result = model.run({
    kind: 'createElement',
    type: definition.type,
    placement: {
      x: Math.round(center.x - width / 2),
      y: Math.round(center.y - height / 2),
      width,
      height,
    },
    data: definition.createData(),
    richText: plainToRichText(text),
  });
  const id = result?.createdId;
  if (id === undefined) return;
  model.markForMeasure([id]);
  // У чек-листа сначала пишут пункты, а не заголовок.
  if (text === '' && type !== 'checklist') startEditing(model, id);
  else select(model, [id]);
}

/** Карточка новой вложенной доски в точке; сразу предлагается название. */
export function createBoardCard(model: BoardModel, center: Point): void {
  const boardId = model.host.createBoard();
  if (boardId === null) {
    model.showNotice(t('board.notice.noProjectBoards'));
    return;
  }
  const definition = definitionFor('board');
  const { width, height } = definition.defaultSize;
  const result = model.run({
    kind: 'createElement',
    type: definition.type,
    placement: {
      x: Math.round(center.x - width / 2),
      y: Math.round(center.y - height / 2),
      width,
      height,
    },
    data: { boardId },
  });
  if (result?.createdId === undefined) return;
  select(model, [result.createdId]);
  model.host.renameBoard(boardId);
}

export function createNote(model: BoardModel, center: Point, text = ''): void {
  createTextElement(model, 'note', center, text);
}
