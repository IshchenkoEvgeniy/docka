import type * as Y from 'yjs';
import {
  ElementSchema,
  ok,
  planMindMapCommand,
  type BoardId,
  type CommandEnvironment,
  type CommandResult,
  type ElementId,
  type MindMapCommand,
  type Result,
} from '../../core';
import { mindMapRootsOf, relayoutMindMaps } from '../mindMapLayout';
import { readElements } from '../projectDocument';
import { writeNewElement } from './newElementRecord';
import { checkTree } from './mindMapEffects';
import { LOCAL_ORIGIN, prepareRecordPatch } from './recordPatch';
import { deleteElements } from './trashCommands';

const topZ = (doc: Y.Doc): number =>
  readElements(doc).items.reduce((max, element) => Math.max(max, element.z), 0);

/**
 * Выполняет команду карты одной транзакцией вместе с раскладкой (ADR 0011).
 * Позиции, выставленные раскладкой, не проверяют закрепление: закреплённый узел
 * не тащится рукой, но раскладка его ставит.
 */
export function executeMindMapCommand(
  doc: Y.Doc,
  boardId: BoardId,
  command: MindMapCommand,
  environment: CommandEnvironment,
): Result<CommandResult> {
  const elements = readElements(doc).items;
  const planned = planMindMapCommand(elements, command, {
    boardId,
    topZ: topZ(doc),
    environment,
  });
  if (!planned.ok) return planned;
  const { create, patches, trash, relayout } = planned.value;
  const writes: (() => void)[] = [];
  for (const { id, changes } of patches) {
    const tree = checkTree(elements, id, changes);
    if (!tree.ok) return tree;
    const prepared = prepareRecordPatch(
      doc.getMap<unknown>('elements'),
      id,
      ElementSchema,
      { ...changes, updatedAt: environment.clock.now() },
      'Элемент не найден',
    );
    if (!prepared.ok) return prepared;
    writes.push(prepared.value);
  }
  const before = mindMapRootsOf(doc, relayout);
  doc.transact(() => {
    if (create !== undefined) writeNewElement(doc, create.element, create.richText);
    writes.forEach((write) => {
      write();
    });
    // План берёт в корзину только живые узлы доски, поэтому удаление не может не найти их.
    if (trash.length > 0)
      deleteElements(
        doc,
        { kind: 'deleteElements', elementIds: trash as ElementId[] }, // id из плана — элементы доски
        environment.clock.now(),
      );
    relayoutMindMaps(doc, [...before, ...relayout, ...(create ? [create.element.id] : [])]);
  }, LOCAL_ORIGIN);
  return ok(
    create === undefined ? {} : { createdId: create.element.id, createdIds: [create.element.id] },
  );
}
