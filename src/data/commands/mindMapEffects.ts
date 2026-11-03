import type * as Y from 'yjs';
import {
  ElementSchema,
  MindMapLinkSchema,
  buildMindMapForest,
  err,
  ok,
  splitMindMapMoves,
  validate,
  type BoardCommand,
  type BoardElement,
  type CommandResult,
  type NewElement,
  type Result,
} from '../../core';
import { mindMapRootsOf, relayoutMindMaps, touchesMindMap } from '../mindMapLayout';
import { readElements } from '../projectDocument';
import { moveElements } from './moveElements';
import { LOCAL_ORIGIN, merge, prepareRecordPatch } from './recordPatch';

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * Поле tree проверяется строгой схемой: общая схема элемента заменяет битое tree на «нет поля»
 * (это защита при чтении), и без этой проверки команда могла бы молча выкинуть узел из карты.
 */
export function checkTree(
  elements: readonly BoardElement[],
  id: string,
  changes: Readonly<Record<string, unknown>>,
): Result<true> {
  if (!('tree' in changes)) return ok(true);
  const patch = changes.tree;
  const current = elements.find((element) => element.id === id)?.tree;
  const next = isRecord(patch) ? merge(current ?? {}, patch) : patch;
  const checked = validate(MindMapLinkSchema.nullable(), next);
  return checked.ok ? ok(true) : err(`Некорректное место в карте: ${checked.error}`);
}

/**
 * Действие с элементами и раскладка затронутых карт — одной транзакцией и одним шагом
 * отмены (ADR 0011). run проверяет всё до записи: ошибка — ничего не изменено.
 */
export function withMindMapLayout(
  doc: Y.Doc,
  ids: readonly string[],
  run: () => Result<CommandResult>,
): Result<CommandResult> {
  if (!touchesMindMap(doc, ids)) return run();
  const before = mindMapRootsOf(doc, ids);
  let result: Result<CommandResult> = ok({});
  doc.transact(() => {
    result = run();
    if (result.ok) relayoutMindMaps(doc, [...before, ...ids]);
  }, LOCAL_ORIGIN);
  return result;
}

type MoveCommand = Extract<BoardCommand, { kind: 'moveElements' }>;

/** Перенос с учётом карт: корень везёт карту, узел запоминает ручной сдвиг с веткой. */
export function moveWithMindMaps(
  doc: Y.Doc,
  command: MoveCommand,
  now: number,
): Result<CommandResult> {
  const ids = command.moves.map((move) => move.elementId);
  if (!touchesMindMap(doc, ids)) return moveElements(doc, command, now);
  const elements = readElements(doc).items;
  const byId = new Map<string, BoardElement>(elements.map((element) => [element.id, element]));
  const split = splitMindMapMoves(buildMindMapForest(elements), command.moves, (id) =>
    byId.get(id),
  );
  const writes: (() => void)[] = [];
  for (const { elementId, dx, dy } of split.offsets) {
    if (byId.get(elementId)?.locked === true)
      return err('Элемент закреплён — сначала открепите его');
    const changes = { tree: { offset: { dx, dy } }, updatedAt: now };
    const tree = checkTree(elements, elementId, changes);
    if (!tree.ok) return tree;
    const prepared = prepareRecordPatch(
      doc.getMap<unknown>('elements'),
      elementId,
      ElementSchema,
      changes,
      'Элемент не найден',
    );
    if (!prepared.ok) return prepared;
    writes.push(prepared.value);
  }
  return withMindMapLayout(doc, ids, () => {
    const moved = moveElements(doc, { ...command, moves: split.moves }, now);
    if (moved.ok)
      writes.forEach((write) => {
        write();
      });
    return moved;
  });
}

type PlaceCommand = Extract<BoardCommand, { kind: 'placeElements' }>;

/**
 * Перетаскивание на доске, задевшее узлы карт: узел в колонку не кладётся; остальное —
 * перенос с учётом карт (колонку можно покинуть, как и при обычном переносе).
 */
export function placeMindMapNodes(
  doc: Y.Doc,
  now: number,
  command: PlaceCommand,
): Result<CommandResult> {
  const nodes = buildMindMapForest(readElements(doc).items).nodes;
  if (command.placements.some((item) => item.parentId !== null && nodes.has(item.elementId)))
    return err('Узел майнд-карты нельзя положить в колонку');
  if (command.placements.some((item) => item.parentId !== null))
    return err('Узлы карты и карточки в колонку переносятся по отдельности');
  return moveWithMindMaps(
    doc,
    { kind: 'moveElements', moves: command.placements.map((item) => ({ ...item })) },
    now,
  );
}

/**
 * Места в картах для пачки новых элементов (вставка, шаблон, список): номер родителя —
 * в этой же пачке. Карточка в колонке узлом не бывает. Ошибка — ничего не создаётся.
 */
export function placeNewMindMapNodes(
  specs: readonly NewElement[],
  planned: readonly BoardElement[],
): Result<BoardElement[]> {
  const result: BoardElement[] = [];
  for (const [index, element] of planned.entries()) {
    const place = specs[index]?.mindMap;
    if (place === undefined) {
      result.push(element);
      continue;
    }
    if (element.parentId !== null) return err('Карточка в колонке не может быть узлом карты');
    const parent = place.parentIndex === undefined ? undefined : planned[place.parentIndex];
    if (place.parentIndex !== undefined && (parent === undefined || place.parentIndex === index))
      return err('Родитель ветки не найден');
    const tree = validate(MindMapLinkSchema, {
      parentId: parent?.id ?? null,
      order: place.order,
      collapsed: place.collapsed,
      offset: null,
      ...(place.direction === undefined ? {} : { direction: place.direction }),
      ...(place.side === undefined ? {} : { side: place.side }),
    });
    if (!tree.ok) return err(`Некорректное место в карте: ${tree.error}`);
    result.push({ ...element, tree: tree.value });
  }
  return ok(result);
}
