import type * as Y from 'yjs';
import {
  BoardSchema,
  ConnectionSchema,
  ElementSchema,
  err,
  isBoardInTrash,
  ok,
  type BoardCommand,
  type BoardId,
  type CommandResult,
  type Connection,
  type ProjectCommand,
  type Result,
  type Timestamp,
} from '../../core';
import { readBoards, readConnections, readElements } from '../projectDocument';
import { commit, prepareRecordPatch } from './recordPatch';

/** Корзина: мягкое удаление полем deletedAt (docs/format.md). */

type Board<K extends BoardCommand['kind']> = Extract<BoardCommand, { kind: K }>;
type Project<K extends ProjectCommand['kind']> = Extract<ProjectCommand, { kind: K }>;
type Write = () => void;

const touches = (connection: Connection, ids: ReadonlySet<string>) =>
  (connection.from.kind === 'element' && ids.has(connection.from.elementId)) ||
  (connection.to.kind === 'element' && ids.has(connection.to.elementId));

/** Элементы вместе со всем, что лежит в них (колонки), рекурсивно. */
function withContents(doc: Y.Doc, ids: readonly string[]): Set<string> {
  const all = readElements(doc).items;
  const result = new Set(ids);
  let grew = true;
  while (grew) {
    grew = false;
    for (const element of all) {
      if (element.parentId !== null && result.has(element.parentId) && !result.has(element.id)) {
        result.add(element.id);
        grew = true;
      }
    }
  }
  return result;
}

function patchAll(
  doc: Y.Doc,
  collection: string,
  schema: typeof ElementSchema | typeof ConnectionSchema,
  ids: Iterable<string>,
  deletedAt: Timestamp | null,
): Result<Write[]> {
  const writes: Write[] = [];
  for (const id of ids) {
    const prepared = prepareRecordPatch(
      doc.getMap<unknown>(collection),
      id,
      schema,
      { deletedAt },
      'Объект не найден',
    );
    if (!prepared.ok) return prepared;
    writes.push(prepared.value);
  }
  return ok(writes);
}

function commitAll(doc: Y.Doc, ...groups: Result<Write[]>[]): Result<CommandResult> {
  const writes: Write[] = [];
  for (const group of groups) {
    if (!group.ok) return group;
    writes.push(...group.value);
  }
  commit(doc, writes);
  return ok({});
}

export function deleteElements(
  doc: Y.Doc,
  command: Board<'deleteElements'>,
  now: Timestamp,
): Result<CommandResult> {
  const elements = readElements(doc).items;
  if (command.elementIds.some((id) => !elements.some((element) => element.id === id)))
    return err('Элемент не найден');
  const targets = withContents(doc, command.elementIds);
  const alive = elements
    .filter((element) => targets.has(element.id) && element.deletedAt === null)
    .map((element) => element.id);
  const arrows = readConnections(doc)
    .items.filter((c) => c.deletedAt === null && touches(c, targets))
    .map((c) => c.id);
  return commitAll(
    doc,
    patchAll(doc, 'elements', ElementSchema, alive, now),
    patchAll(doc, 'connections', ConnectionSchema, arrows, now),
  );
}

/** Восстанавливает элементы и то, что было удалено вместе с ними (тот же момент удаления). */
export function restoreElements(
  doc: Y.Doc,
  command: Board<'restoreElements'>,
): Result<CommandResult> {
  const elements = readElements(doc).items;
  const moments = new Set(
    elements
      .filter((e) => command.elementIds.includes(e.id) && e.deletedAt !== null)
      .map((e) => e.deletedAt),
  );
  const targets = withContents(doc, command.elementIds);
  const restored = elements
    .filter((e) => targets.has(e.id) && moments.has(e.deletedAt))
    .map((e) => e.id);
  const aliveAfter = new Set([
    ...elements.filter((e) => e.deletedAt === null).map((e) => e.id),
    ...restored,
  ]);
  const endpointsAlive = (c: Connection) =>
    (c.from.kind !== 'element' || aliveAfter.has(c.from.elementId)) &&
    (c.to.kind !== 'element' || aliveAfter.has(c.to.elementId));
  const arrows = readConnections(doc).items.filter(
    (c) => moments.has(c.deletedAt) && touches(c, new Set(restored)) && endpointsAlive(c),
  );
  return commitAll(
    doc,
    patchAll(doc, 'elements', ElementSchema, restored, null),
    patchAll(
      doc,
      'connections',
      ConnectionSchema,
      arrows.map((c) => c.id),
      null,
    ),
  );
}

export function setConnectionsDeleted(
  doc: Y.Doc,
  ids: readonly string[],
  deletedAt: Timestamp | null,
): Result<CommandResult> {
  return commitAll(doc, patchAll(doc, 'connections', ConnectionSchema, ids, deletedAt));
}

function boardLookups(doc: Y.Doc) {
  const boards = new Map(readBoards(doc).items.map((board) => [board.id, board]));
  return {
    boards,
    parentOf: (id: BoardId) => boards.get(id)?.parentId,
    deletedAtOf: (id: BoardId) => boards.get(id)?.deletedAt,
  };
}

export function deleteBoard(
  doc: Y.Doc,
  command: Project<'deleteBoard'>,
  now: Timestamp,
): Result<CommandResult> {
  const board = boardLookups(doc).boards.get(command.boardId);
  if (board === undefined) return err('Доска не найдена');
  if (board.parentId === null) return err('Корневую доску проекта удалить нельзя');
  const prepared = prepareRecordPatch(
    doc.getMap<unknown>('boards'),
    command.boardId,
    BoardSchema,
    { deletedAt: now, updatedAt: now },
    'Доска не найдена',
  );
  return commitAll(doc, prepared.ok ? ok([prepared.value]) : prepared);
}

export function restoreBoard(
  doc: Y.Doc,
  command: Project<'restoreBoard'>,
  now: Timestamp,
): Result<CommandResult> {
  const { boards, parentOf, deletedAtOf } = boardLookups(doc);
  const board = boards.get(command.boardId);
  if (board === undefined) return err('Доска не найдена');
  const root = [...boards.values()].find((candidate) => candidate.parentId === null);
  const parentInTrash =
    board.parentId !== null && isBoardInTrash(board.parentId, parentOf, deletedAtOf);
  const changes = {
    deletedAt: null,
    updatedAt: now,
    ...(parentInTrash && root ? { parentId: root.id } : {}),
  };
  const prepared = prepareRecordPatch(
    doc.getMap<unknown>('boards'),
    command.boardId,
    BoardSchema,
    changes,
    'Доска не найдена',
  );
  return commitAll(doc, prepared.ok ? ok([prepared.value]) : prepared);
}

export function deleteTag(doc: Y.Doc, command: Project<'deleteTag'>): Result<CommandResult> {
  const tags = doc.getMap<unknown>('tags');
  if (!tags.has(command.tagId)) return err('Тег не найден');
  commit(doc, [
    () => {
      tags.delete(command.tagId);
    },
  ]);
  return ok({});
}

type TrashKind = 'deleteElements' | 'restoreElements' | 'deleteConnections' | 'restoreConnections';

/** Команды корзины документа доски. */
export function executeBoardTrashCommand(
  doc: Y.Doc,
  command: Board<TrashKind>,
  now: Timestamp,
): Result<CommandResult> {
  switch (command.kind) {
    case 'deleteElements':
      return deleteElements(doc, command, now);
    case 'restoreElements':
      return restoreElements(doc, command);
    case 'deleteConnections':
      return setConnectionsDeleted(doc, command.connectionIds, now);
    case 'restoreConnections':
      return setConnectionsDeleted(doc, command.connectionIds, null);
  }
}
