import * as Y from 'yjs';
import type { z } from 'zod';
import { validate } from '../core';

/**
 * Раскладка записей (доска, тег, элемент, связь) в Yjs.
 *
 * Запись — Y.Map с полями. Вложенные объекты (например, `data` элемента) — вложенные Y.Map,
 * чтобы правки разных полей с разных устройств сливались, а не затирали друг друга целиком.
 * Массивы и примитивы хранятся как значения (последняя запись побеждает).
 */

export type RecordMap = Y.Map<unknown>;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    !(value instanceof Uint8Array)
  );
}

function toYValue(value: unknown): unknown {
  if (!isPlainObject(value)) return value;
  const map = new Y.Map<unknown>();
  for (const [key, nested] of Object.entries(value)) map.set(key, toYValue(nested));
  return map;
}

/** Создаёт Y.Map записи из обычного объекта. */
export function createRecord(record: Readonly<Record<string, unknown>>): RecordMap {
  const map = toYValue(record);
  if (!(map instanceof Y.Map)) throw new Error('createRecord: ожидался объект');
  return map as RecordMap; // toYValue объекта всегда возвращает Y.Map<unknown>
}

/** Меняет поля записи; вложенные объекты обновляются по полям, а не заменяются целиком. */
export function updateRecord(map: RecordMap, changes: Readonly<Record<string, unknown>>): void {
  for (const [key, value] of Object.entries(changes)) {
    const current = map.get(key);
    if (current instanceof Y.Map && isPlainObject(value)) {
      updateRecord(current as RecordMap, value); // вложенные карты создаёт только createRecord
    } else {
      map.set(key, toYValue(value));
    }
  }
}

export interface ReadResult<T> {
  /** Записи, прошедшие проверку схемой. */
  readonly items: T[];
  /** Ключи записей, не прошедших проверку, с причиной (битые данные из файла). */
  readonly invalid: { readonly key: string; readonly error: string }[];
}

/** Читает все записи коллекции и проверяет каждую схемой; битые не роняют чтение. */
export function readCollection<S extends z.ZodType>(
  collection: Y.Map<unknown>,
  schema: S,
): ReadResult<z.infer<S>> {
  const items: z.infer<S>[] = [];
  const invalid: { key: string; error: string }[] = [];
  collection.forEach((value, key) => {
    const plain: unknown = value instanceof Y.AbstractType ? value.toJSON() : value;
    const result = validate(schema, plain);
    if (result.ok) items.push(result.value);
    else invalid.push({ key, error: result.error });
  });
  return { items, invalid };
}
