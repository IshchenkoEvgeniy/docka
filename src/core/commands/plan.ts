import { err, ok, type Result } from '../result';
import {
  BoardSchema,
  ConnectionSchema,
  ElementSchema,
  TagSchema,
  validate,
  wouldCreateCycle,
  type Board,
  type BoardId,
  type BoardElement,
  type Connection,
  type Tag,
} from '../model';
import type { CommandEnvironment } from './environment';
import type { BoardCommand, NewElement, ProjectCommand } from './types';

/**
 * Чистое планирование команд: из входа и текущего состояния — новая запись, проверенная схемой.
 * Без Yjs: слой data только записывает то, что здесь проверено.
 */

type Extract<U, K> = U extends { readonly kind: K } ? U : never;

export function planBoard(
  command: Extract<ProjectCommand, 'createBoard'>,
  boardId: BoardId,
  environment: CommandEnvironment,
): Result<Board> {
  const now = environment.clock.now();
  return validate(BoardSchema, {
    id: boardId,
    title: command.title,
    parentId: command.parentId,
    icon: null,
    color: 'default',
    background: 'dots',
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  });
}

/** Перенос доски: корень не переносится, в себя и в своих потомков — нельзя. */
export function checkBoardMove(
  boardId: BoardId,
  newParentId: BoardId,
  parentOf: (id: BoardId) => BoardId | null | undefined,
): Result<true> {
  if (parentOf(boardId) === null) return err('Корневую доску проекта нельзя перенести');
  if (parentOf(newParentId) === undefined) return err('Доска назначения не найдена');
  if (wouldCreateCycle(boardId, newParentId, parentOf))
    return err('Нельзя положить доску внутрь самой себя');
  return ok(true);
}

export function planTag(
  command: Extract<ProjectCommand, 'createTag'>,
  environment: CommandEnvironment,
): Result<Tag> {
  return validate(TagSchema, {
    id: environment.ids.next(),
    name: command.name,
    color: command.color,
  });
}

export function planElement(
  command: NewElement,
  boardId: BoardId,
  topZ: number,
  environment: CommandEnvironment,
): Result<BoardElement> {
  const now = environment.clock.now();
  return validate(ElementSchema, {
    id: environment.ids.next(),
    boardId,
    type: command.type,
    ...command.placement,
    z: topZ + 1,
    parentId: command.parentId ?? null,
    color: command.color ?? 'default',
    locked: command.locked ?? false,
    tagIds: command.tagIds ?? [],
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    data: command.data,
  });
}

export function planConnection(
  command: Extract<BoardCommand, 'createConnection'>,
  boardId: BoardId,
  environment: CommandEnvironment,
): Result<Connection> {
  return validate(ConnectionSchema, {
    id: environment.ids.next(),
    boardId,
    from: command.from,
    to: command.to,
    label: command.style?.label ?? '',
    color: command.style?.color ?? 'default',
    lineStyle: command.style?.lineStyle ?? 'curved',
    startMarker: command.style?.startMarker ?? 'none',
    endMarker: command.style?.endMarker ?? 'arrow',
    deletedAt: null,
  });
}
