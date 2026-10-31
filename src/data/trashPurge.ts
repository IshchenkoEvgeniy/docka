import * as Y from 'yjs';
import { fieldsOf, isTrashExpired, type BoardId, type Timestamp } from '../core';
import { ENTITY_TEXTS_FIELD } from './entityText';
import {
  ENTITIES_MAP,
  ENTITY_TYPES_MAP,
  readBoards,
  readConnections,
  readElements,
  readEntities,
  readEntityTypes,
} from './projectDocument';

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

function mapOf(parent: Y.Map<unknown>, key: string): Y.Map<unknown> | null {
  const value = parent.get(key);
  return value instanceof Y.Map ? (value as Y.Map<unknown>) : null; // вложенные карты записей
}

/** Скрытые поля старше 30 дней: из типа и из значений и текстов его сущностей. */
function purgeExpiredFields(doc: Y.Doc, now: Timestamp): number {
  let count = 0;
  const entities = doc.getMap<unknown>(ENTITIES_MAP);
  for (const type of readEntityTypes(doc).items) {
    const expired = fieldsOf(type, true)
      .filter((field) => isTrashExpired(field.deletedAt, now))
      .map((field) => field.id);
    if (expired.length === 0) continue;
    const record = mapOf(doc.getMap<unknown>(ENTITY_TYPES_MAP), type.id);
    const fields = record === null ? null : mapOf(record, 'fields');
    expired.forEach((id) => fields?.delete(id));
    entities.forEach((value) => {
      if (!(value instanceof Y.Map) || value.get('typeId') !== type.id) return;
      const entity = value as Y.Map<unknown>; // записи — Y.Map
      for (const id of expired) {
        mapOf(entity, 'values')?.delete(id);
        mapOf(entity, ENTITY_TEXTS_FIELD)?.delete(id);
      }
    });
    count += expired.length;
  }
  return count;
}

/**
 * Сущности, типы и скрытые поля старше 30 дней (ADR 0004). Тип удаляется, только когда
 * у него не осталось ни одной сущности, даже в корзине.
 */
export function purgeEntities(doc: Y.Doc, now: Timestamp): number {
  const entities = readEntities(doc).items;
  const expired = entities.filter((entity) => isTrashExpired(entity.deletedAt, now));
  const gone = new Set(expired.map((entity) => entity.id));
  const typesInUse = new Set(entities.filter((e) => !gone.has(e.id)).map((e) => e.typeId));
  const expiredTypes = readEntityTypes(doc).items.filter(
    (type) => isTrashExpired(type.deletedAt, now) && !typesInUse.has(type.id),
  );
  let count = 0;
  doc.transact(() => {
    gone.forEach((id) => {
      doc.getMap(ENTITIES_MAP).delete(id);
    });
    expiredTypes.forEach((type) => {
      doc.getMap(ENTITY_TYPES_MAP).delete(type.id);
    });
    count = gone.size + expiredTypes.length + purgeExpiredFields(doc, now);
  }, PURGE_ORIGIN);
  return count;
}
