import type * as Y from 'yjs';
import { isTrashExpired, type BoardId, type Timestamp } from '../core';
import { readBoards, readConnections, readElements } from './projectDocument';

/**
 * Окончательное удаление из корзины того, что лежит дольше 30 дней. Не отменяется «Отменить»
 * (своя метка транзакции) и записывается в журнал — другие устройства получат то же удаление.
 */
export const PURGE_ORIGIN = Symbol('trash-purge');

/** Удаляет просроченные элементы и стрелки доски (и стрелки к удалённым элементам). */
export function purgeBoardDocument(doc: Y.Doc, now: Timestamp): number {
  const expired = new Set(
    readElements(doc)
      .items.filter((e) => isTrashExpired(e.deletedAt, now))
      .map((e) => e.id),
  );
  const expiredArrows = readConnections(doc).items.filter(
    (c) =>
      isTrashExpired(c.deletedAt, now) ||
      (c.from.kind === 'element' && expired.has(c.from.elementId)) ||
      (c.to.kind === 'element' && expired.has(c.to.elementId)),
  );
  if (expired.size === 0 && expiredArrows.length === 0) return 0;
  doc.transact(() => {
    expired.forEach((id) => {
      doc.getMap('elements').delete(id);
    });
    expiredArrows.forEach((c) => {
      doc.getMap('connections').delete(c.id);
    });
  }, PURGE_ORIGIN);
  return expired.size + expiredArrows.length;
}

/** Удаляет просроченные доски вместе со всеми вложенными; возвращает id удалённых досок. */
export function purgeProjectDocument(doc: Y.Doc, now: Timestamp): BoardId[] {
  const boards = readBoards(doc).items;
  const purged = new Set(
    boards.filter((board) => isTrashExpired(board.deletedAt, now)).map((board) => board.id),
  );
  let grew = purged.size > 0;
  while (grew) {
    grew = false;
    for (const board of boards) {
      if (board.parentId !== null && purged.has(board.parentId) && !purged.has(board.id)) {
        purged.add(board.id);
        grew = true;
      }
    }
  }
  if (purged.size === 0) return [];
  doc.transact(() => {
    purged.forEach((id) => {
      doc.getMap('boards').delete(id);
    });
  }, PURGE_ORIGIN);
  return [...purged];
}
