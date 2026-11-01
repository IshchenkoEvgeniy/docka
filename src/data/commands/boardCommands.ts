import * as Y from 'yjs';
import {
  ConnectionSchema,
  ElementSchema,
  RichTextSchema,
  err,
  ok,
  planConnection,
  planElement,
  type BoardCommand,
  type BoardElement,
  type BoardId,
  type CommandEnvironment,
  type CommandResult,
  type Endpoint,
  type NewElement,
  type Result,
} from '../../core';
import { TEXT_FIELD, fillFragment } from '../richText';
import { createRecord } from '../yjsRecords';
import { commit, prepareRecordPatch } from './recordPatch';
import { executeBoardTrashCommand } from './trashCommands';
import { moveElements } from './moveElements';

type Command<K extends BoardCommand['kind']> = Extract<BoardCommand, { kind: K }>;

const elementsOf = (doc: Y.Doc) => doc.getMap<unknown>('elements');
const connectionsOf = (doc: Y.Doc) => doc.getMap<unknown>('connections');
const NOT_FOUND = 'Элемент не найден';

function elementField(doc: Y.Doc, id: string, field: string): unknown {
  const record = elementsOf(doc).get(id);
  return record instanceof Y.Map ? (record as Y.Map<unknown>).get(field) : undefined; // записи — Y.Map
}

/** Пределы z среди элементов доски (для «на передний/задний план» и новых элементов). */
function zRange(doc: Y.Doc): { min: number; max: number } {
  let min = 0;
  let max = 0;
  elementsOf(doc).forEach((_, id) => {
    const z = elementField(doc, id, 'z');
    if (typeof z !== 'number') return;
    min = Math.min(min, z);
    max = Math.max(max, z);
  });
  return { min, max };
}

/** Готовит изменения нескольких элементов: если хоть одно невалидно — не меняется ничего. */
function prepareAll(
  doc: Y.Doc,
  patches: readonly { id: string; changes: Record<string, unknown> }[],
): Result<(() => void)[]> {
  const writes: (() => void)[] = [];
  for (const { id, changes } of patches) {
    if (elementField(doc, id, 'locked') === true && ('x' in changes || 'width' in changes)) {
      return err('Элемент закреплён — сначала открепите его');
    }
    const prepared = prepareRecordPatch(elementsOf(doc), id, ElementSchema, changes, NOT_FOUND);
    if (!prepared.ok) return prepared;
    writes.push(prepared.value);
  }
  return ok(writes);
}

function apply(doc: Y.Doc, writes: Result<(() => void)[]>): Result<CommandResult> {
  if (!writes.ok) return writes;
  commit(doc, writes.value);
  return ok({});
}

function endpointExists(doc: Y.Doc, endpoint: Endpoint | undefined): boolean {
  return endpoint?.kind !== 'element' || elementsOf(doc).has(endpoint.elementId);
}

/** Создаёт элементы поверх остальных; если хоть один невалиден — не создаётся ни один. */
function createElements(
  doc: Y.Doc,
  boardId: BoardId,
  specs: readonly NewElement[],
  environment: CommandEnvironment,
): Result<CommandResult> {
  const top = zRange(doc).max;
  const planned: { element: BoardElement; richText: NewElement['richText'] }[] = [];
  for (const [index, spec] of specs.entries()) {
    const inBatch = spec.parentIndex === undefined ? undefined : planned[spec.parentIndex];
    if (spec.parentIndex !== undefined && (inBatch === undefined || spec.parentIndex >= index))
      return err('Контейнер не найден');
    const parentId = inBatch?.element.id ?? spec.parentId ?? null;
    if (inBatch === undefined && parentId !== null && !elementsOf(doc).has(parentId))
      return err('Контейнер не найден');
    const element = planElement({ ...spec, parentId }, boardId, top + index, environment);
    if (!element.ok) return element;
    if (spec.richText !== undefined && !RichTextSchema.safeParse(spec.richText).success)
      return err('Некорректный текст элемента');
    planned.push({ element: element.value, richText: spec.richText });
  }
  commit(
    doc,
    planned.map(({ element, richText }) => () => {
      const record = createRecord(element);
      elementsOf(doc).set(element.id, record);
      if (richText === undefined) return;
      const fragment = new Y.XmlFragment();
      record.set(TEXT_FIELD, fragment);
      fillFragment(fragment, richText);
    }),
  );
  const createdIds = planned.map(({ element }) => element.id);
  return ok({ ...(createdIds[0] === undefined ? {} : { createdId: createdIds[0] }), createdIds });
}

function reorder(
  doc: Y.Doc,
  command: Command<'reorderElements'>,
  now: number,
): Result<CommandResult> {
  const { min, max } = zRange(doc);
  const byZ = [...command.elementIds].sort(
    (a, b) => Number(elementField(doc, a, 'z')) - Number(elementField(doc, b, 'z')),
  );
  const start = command.to === 'front' ? max + 1 : min - byZ.length;
  return apply(
    doc,
    prepareAll(
      doc,
      byZ.map((id, index) => ({ id, changes: { z: start + index, updatedAt: now } })),
    ),
  );
}

function createConnection(
  doc: Y.Doc,
  boardId: BoardId,
  command: Command<'createConnection'>,
  environment: CommandEnvironment,
): Result<CommandResult> {
  if (!endpointExists(doc, command.from) || !endpointExists(doc, command.to))
    return err('Стрелка ссылается на несуществующий элемент');
  const connection = planConnection(command, boardId, environment);
  if (!connection.ok) return connection;
  commit(doc, [() => connectionsOf(doc).set(connection.value.id, createRecord(connection.value))]);
  return ok({ createdId: connection.value.id });
}

function updateConnection(doc: Y.Doc, command: Command<'updateConnection'>): Result<CommandResult> {
  if (!endpointExists(doc, command.changes.from) || !endpointExists(doc, command.changes.to)) {
    return err('Стрелка ссылается на несуществующий элемент');
  }
  const prepared = prepareRecordPatch(
    connectionsOf(doc),
    command.connectionId,
    ConnectionSchema,
    { ...command.changes },
    'Стрелка не найдена',
    ['from', 'to'],
  );
  return apply(doc, prepared.ok ? ok([prepared.value]) : prepared);
}

/** Перенос в контейнер и из него: контейнер должен существовать и не быть самим элементом. */
function placeElements(
  doc: Y.Doc,
  now: number,
  command: Command<'placeElements'>,
): Result<CommandResult> {
  for (const { elementId, parentId } of command.placements) {
    if (parentId === null) continue;
    if (parentId === elementId || !elementsOf(doc).has(parentId)) return err('Контейнер не найден');
    if (elementField(doc, parentId, 'parentId') !== null) return err('Колонки не вкладываются');
  }
  return patchElements(
    doc,
    now,
    command.placements.map(({ elementId, x, y, parentId }) => ({
      id: elementId,
      changes: { x, y, parentId },
    })),
  );
}

/** Правки полей элементов одной транзакцией; у каждого обновляется updatedAt. */
function patchElements(
  doc: Y.Doc,
  now: number,
  patches: readonly { id: string; changes: Readonly<Record<string, unknown>> }[],
): Result<CommandResult> {
  return apply(
    doc,
    prepareAll(
      doc,
      patches.map(({ id, changes }) => ({ id, changes: { ...changes, updatedAt: now } })),
    ),
  );
}

/** Выполняет команду над документом доски. Ошибка — ничего не изменено. */
export function executeBoardCommand(
  doc: Y.Doc,
  boardId: BoardId,
  command: BoardCommand,
  environment: CommandEnvironment,
): Result<CommandResult> {
  const now = environment.clock.now();
  switch (command.kind) {
    case 'createElement':
      return createElements(doc, boardId, [command], environment);
    case 'createElements':
      return createElements(doc, boardId, command.elements, environment);
    case 'updateElement':
      return patchElements(doc, now, [{ id: command.elementId, changes: command.changes }]);
    case 'updateElements':
      return patchElements(
        doc,
        now,
        command.elementIds.map((id) => ({ id, changes: command.changes })),
      );
    case 'moveElements':
      return moveElements(doc, command, now);
    case 'placeElements':
      return placeElements(doc, now, command);
    case 'resizeElement':
      return patchElements(doc, now, [
        { id: command.elementId, changes: { ...command.placement } },
      ]);
    case 'reorderElements':
      return reorder(doc, command, now);
    case 'createConnection':
      return createConnection(doc, boardId, command, environment);
    case 'updateConnection':
      return updateConnection(doc, command);
    case 'deleteElements':
    case 'restoreElements':
    case 'deleteConnections':
    case 'restoreConnections':
      return executeBoardTrashCommand(doc, command, now);
  }
}

/**
 * Данные, полученные не действием пользователя (превью ссылки из сети): проверяются схемой,
 * пишутся в журнал, но не становятся шагом отмены.
 */
export const FETCHED_ORIGIN = Symbol('fetched');

export function fillElementData(
  doc: Y.Doc,
  elementId: string,
  data: Readonly<Record<string, unknown>>,
  now: number,
): Result<CommandResult> {
  const prepared = prepareRecordPatch(
    elementsOf(doc),
    elementId,
    ElementSchema,
    { data, updatedAt: now },
    NOT_FOUND,
  );
  if (!prepared.ok) return prepared;
  doc.transact(prepared.value, FETCHED_ORIGIN);
  return ok({});
}
