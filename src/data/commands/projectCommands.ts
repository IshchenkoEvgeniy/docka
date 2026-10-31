import * as Y from 'yjs';
import {
  BoardSchema,
  TagSchema,
  checkBoardMove,
  err,
  ok,
  planBoard,
  planTag,
  type BoardId,
  type CommandEnvironment,
  type CommandResult,
  type ProjectCommand,
  type Result,
} from '../../core';
import { createRecord } from '../yjsRecords';
import { executeEntityCommand, isEntityCommand } from './entityCommands';
import { commit, prepareRecordPatch } from './recordPatch';
import { deleteBoard, deleteTag, restoreBoard } from './trashCommands';

const boardsOf = (doc: Y.Doc) => doc.getMap<unknown>('boards');
const tagsOf = (doc: Y.Doc) => doc.getMap<unknown>('tags');

/** Родитель доски: null — корень, undefined — доски нет (или запись повреждена). */
function parentLookup(doc: Y.Doc): (id: BoardId) => BoardId | null | undefined {
  return (id) => {
    const record = boardsOf(doc).get(id);
    if (!(record instanceof Y.Map)) return undefined;
    const parent: unknown = record.get('parentId');
    if (parent === null) return null;
    return typeof parent === 'string' ? (parent as BoardId) : undefined; // id из той же коллекции
  };
}

function insert(
  doc: Y.Doc,
  collection: Y.Map<unknown>,
  id: string,
  record: object,
): Result<CommandResult> {
  commit(doc, [() => collection.set(id, createRecord(record as Record<string, unknown>))]);
  return ok({ createdId: id });
}

function patch(doc: Y.Doc, prepared: Result<() => void>): Result<CommandResult> {
  if (!prepared.ok) return prepared;
  commit(doc, [prepared.value]);
  return ok({});
}

type Command<K extends ProjectCommand['kind']> = Extract<ProjectCommand, { kind: K }>;

function renameProject(doc: Y.Doc, command: Command<'renameProject'>): Result<CommandResult> {
  const name = command.name.trim();
  if (name === '') return err('Название проекта не может быть пустым');
  commit(doc, [() => doc.getMap<unknown>('meta').set('name', name)]);
  return ok({});
}

function createBoard(
  doc: Y.Doc,
  command: Command<'createBoard'>,
  environment: CommandEnvironment,
): Result<CommandResult> {
  if (parentLookup(doc)(command.parentId) === undefined)
    return err('Родительская доска не найдена');
  const board = planBoard(command, environment.ids.next() as BoardId, environment); // id проверит схема
  return board.ok ? insert(doc, boardsOf(doc), board.value.id, board.value) : board;
}

function moveBoard(
  doc: Y.Doc,
  command: Command<'moveBoard'>,
  environment: CommandEnvironment,
): Result<CommandResult> {
  const allowed = checkBoardMove(command.boardId, command.newParentId, parentLookup(doc));
  if (!allowed.ok) return allowed;
  const changes = { parentId: command.newParentId, updatedAt: environment.clock.now() };
  return patch(
    doc,
    prepareRecordPatch(boardsOf(doc), command.boardId, BoardSchema, changes, 'Доска не найдена'),
  );
}

function createTag(
  doc: Y.Doc,
  command: Command<'createTag'>,
  environment: CommandEnvironment,
): Result<CommandResult> {
  const tag = planTag(command, environment);
  return tag.ok ? insert(doc, tagsOf(doc), tag.value.id, tag.value) : tag;
}

/** Выполняет команду над документом проекта. Ошибка — ничего не изменено. */
export function executeProjectCommand(
  doc: Y.Doc,
  command: ProjectCommand,
  environment: CommandEnvironment,
): Result<CommandResult> {
  if (isEntityCommand(command)) return executeEntityCommand(doc, command, environment);
  switch (command.kind) {
    case 'renameProject':
      return renameProject(doc, command);
    case 'createBoard':
      return createBoard(doc, command, environment);
    case 'updateBoard': {
      const changes = { ...command.changes, updatedAt: environment.clock.now() };
      return patch(
        doc,
        prepareRecordPatch(
          boardsOf(doc),
          command.boardId,
          BoardSchema,
          changes,
          'Доска не найдена',
        ),
      );
    }
    case 'moveBoard':
      return moveBoard(doc, command, environment);
    case 'createTag':
      return createTag(doc, command, environment);
    case 'deleteBoard':
      return deleteBoard(doc, command, environment.clock.now());
    case 'restoreBoard':
      return restoreBoard(doc, command, environment.clock.now());
    case 'deleteTag':
      return deleteTag(doc, command);
    case 'updateTag':
      return patch(
        doc,
        prepareRecordPatch(tagsOf(doc), command.tagId, TagSchema, command.changes, 'Тег не найден'),
      );
  }
}
