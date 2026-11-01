import * as Y from 'yjs';
import {
  ConnectionSchema,
  ElementSchema,
  err,
  ok,
  type BoardCommand,
  type CommandResult,
  type Result,
} from '../../core';
import { commit, prepareRecordPatch } from './recordPatch';

type MoveCommand = Extract<BoardCommand, { kind: 'moveElements' }>;

function prepareMoves(doc: Y.Doc, command: MoveCommand, now: number): Result<(() => void)[]> {
  const elements = doc.getMap<unknown>('elements');
  const writes: (() => void)[] = [];
  for (const { elementId, x, y, parentId } of command.moves) {
    const raw = elements.get(elementId);
    const parsed = ElementSchema.safeParse(raw instanceof Y.Map ? raw.toJSON() : raw);
    if (parsed.success && parsed.data.locked)
      return err('Элемент закреплён — сначала открепите его');
    if (parentId !== undefined && parentId !== null) {
      const parent = elements.get(parentId);
      const parsedParent = ElementSchema.safeParse(
        parent instanceof Y.Map ? parent.toJSON() : parent,
      );
      if (!parsedParent.success || parentId === elementId || parsedParent.data.parentId !== null)
        return err('Контейнер не найден');
    }
    const prepared = prepareRecordPatch(
      elements,
      elementId,
      ElementSchema,
      { x, y, ...(parentId === undefined ? {} : { parentId }), updatedAt: now },
      'Элемент не найден',
    );
    if (!prepared.ok) return prepared;
    writes.push(prepared.value);
  }
  return ok(writes);
}

/** Сначала проверяем весь перенос, включая стрелки; частичной записи быть не может. */
export function moveElements(doc: Y.Doc, command: MoveCommand, now: number): Result<CommandResult> {
  const preparedMoves = prepareMoves(doc, command, now);
  if (!preparedMoves.ok) return preparedMoves;
  const writes = preparedMoves.value;
  const elements = doc.getMap<unknown>('elements');
  const connections = doc.getMap<unknown>('connections');
  for (const { connectionId, from, to } of command.connections ?? []) {
    if ([from, to].some((end) => end.kind === 'element' && !elements.has(end.elementId)))
      return err('Стрелка ссылается на несуществующий элемент');
    const prepared = prepareRecordPatch(
      connections,
      connectionId,
      ConnectionSchema,
      { from, to },
      'Стрелка не найдена',
      ['from', 'to'],
    );
    if (!prepared.ok) return prepared;
    writes.push(prepared.value);
  }
  commit(doc, writes);
  return ok({});
}
