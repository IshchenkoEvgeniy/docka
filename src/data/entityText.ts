import * as Y from 'yjs';
import { ENTITIES_MAP } from './projectDocument';
import { TEXT_INIT_ORIGIN, fillFragment, fragmentToRich } from './richText';

/**
 * Длинный текст полей сущности — Y.XmlFragment в карте `texts` записи сущности (ADR 0004):
 * правки сливаются посимвольно, корзина и отмена захватывают текст вместе с сущностью.
 */
export const ENTITY_TEXTS_FIELD = 'texts';

function recordOf(doc: Y.Doc, entityId: string): Y.Map<unknown> | null {
  const record = doc.getMap<unknown>(ENTITIES_MAP).get(entityId);
  return record instanceof Y.Map ? (record as Y.Map<unknown>) : null; // записи — Y.Map
}

function textsOf(record: Y.Map<unknown>): Y.Map<unknown> | null {
  const texts = record.get(ENTITY_TEXTS_FIELD);
  return texts instanceof Y.Map ? (texts as Y.Map<unknown>) : null; // создаёт createEntity
}

export function entityTextOf(doc: Y.Doc, entityId: string, fieldId: string): Y.XmlFragment | null {
  const record = recordOf(doc, entityId);
  const text = record === null ? undefined : textsOf(record)?.get(fieldId);
  return text instanceof Y.XmlFragment ? text : null;
}

/** Пустые тексты полей новой сущности — в той же транзакции, что и сама сущность. */
export function createEntityTexts(record: Y.Map<unknown>, fieldIds: readonly string[]): void {
  const texts = new Y.Map<unknown>();
  record.set(ENTITY_TEXTS_FIELD, texts);
  for (const id of fieldIds) texts.set(id, new Y.XmlFragment());
}

/** Текст для правки; у поля, добавленного после создания сущности, создаётся при первой правке. */
export function ensureEntityText(
  doc: Y.Doc,
  entityId: string,
  fieldId: string,
): Y.XmlFragment | null {
  const existing = entityTextOf(doc, entityId, fieldId);
  if (existing !== null) return existing;
  const record = recordOf(doc, entityId);
  if (record === null) return null;
  const fragment = new Y.XmlFragment();
  doc.transact(() => {
    const texts = textsOf(record) ?? new Y.Map<unknown>();
    if (textsOf(record) === null) record.set(ENTITY_TEXTS_FIELD, texts);
    texts.set(fieldId, fragment);
  }, TEXT_INIT_ORIGIN);
  return fragment;
}

/** Копии текстов одной сущности в запись другой (независимая копия). */
export function copyEntityTexts(source: Y.Map<unknown>, target: Y.Map<unknown>): void {
  const texts = new Y.Map<unknown>();
  target.set(ENTITY_TEXTS_FIELD, texts);
  textsOf(source)?.forEach((value, fieldId) => {
    if (!(value instanceof Y.XmlFragment)) return;
    const copy = new Y.XmlFragment();
    texts.set(fieldId, copy);
    fillFragment(copy, fragmentToRich(value));
  });
}

/** Все тексты сущности (поиск упоминаний). */
export function entityTexts(doc: Y.Doc, entityId: string): Y.XmlFragment[] {
  const record = recordOf(doc, entityId);
  const texts = record === null ? null : textsOf(record);
  const result: Y.XmlFragment[] = [];
  texts?.forEach((value) => {
    if (value instanceof Y.XmlFragment) result.push(value);
  });
  return result;
}

/**
 * Хранилище нового поля во всех сущностях типа — в той же транзакции, что и поле:
 * пустой текст или пустое множество. Создай их каждое устройство само при первой правке,
 * одновременные правки затёрли бы друг друга.
 */
export function addFieldStorage(
  doc: Y.Doc,
  typeId: string,
  fieldId: string,
  storage: 'text' | 'flags',
): void {
  doc.getMap<unknown>(ENTITIES_MAP).forEach((value) => {
    if (!(value instanceof Y.Map) || value.get('typeId') !== typeId) return;
    const record = value as Y.Map<unknown>; // записи — Y.Map
    if (storage === 'text') {
      const texts = textsOf(record) ?? new Y.Map<unknown>();
      if (textsOf(record) === null) record.set(ENTITY_TEXTS_FIELD, texts);
      if (!texts.has(fieldId)) texts.set(fieldId, new Y.XmlFragment());
      return;
    }
    const values = record.get('values');
    if (values instanceof Y.Map && !values.has(fieldId)) values.set(fieldId, new Y.Map());
  });
}
