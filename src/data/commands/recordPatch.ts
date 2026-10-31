import * as Y from 'yjs';
import type { z } from 'zod';
import { err, ok, validate, type Result } from '../../core';
import { createRecord, updateRecord } from '../yjsRecords';

/** Метка локальных правок: их записывает свой журнал и отменяет «Отменить» (правки с диска — нет). */
export const LOCAL_ORIGIN = Symbol('local-edit');

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Слияние как в updateRecord: вложенные объекты — по полям, кроме ключей replace — их целиком. */
function merge(
  current: unknown,
  changes: Readonly<Record<string, unknown>>,
  replace: readonly string[] = [],
): Record<string, unknown> {
  const base: Record<string, unknown> = isPlainObject(current) ? { ...current } : {};
  for (const [key, value] of Object.entries(changes)) {
    if (value === undefined) continue;
    const nested = isPlainObject(value) && isPlainObject(base[key]) && !replace.includes(key);
    base[key] = nested ? merge(base[key], value) : value;
  }
  return base;
}

function definedOnly(changes: Readonly<Record<string, unknown>>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(changes).filter(([, value]) => value !== undefined));
}

/**
 * Проверяет запись после изменений схемой и только потом пишет изменённые поля.
 * Невалидная правка не меняет ничего — даже частично.
 */
export function prepareRecordPatch(
  collection: Y.Map<unknown>,
  key: string,
  schema: z.ZodType,
  changes: Readonly<Record<string, unknown>>,
  notFound: string,
  /** Вложенные объекты, которые заменяются целиком (например, конец стрелки другого вида). */
  replace: readonly string[] = [],
): Result<() => void> {
  const record = collection.get(key);
  if (!(record instanceof Y.Map)) return err(notFound);
  const current: unknown = record.toJSON();
  const checked = validate(schema, merge(current, changes, replace));
  if (!checked.ok) return err(`Некорректное изменение: ${checked.error}`);
  const defined = definedOnly(changes);
  const merged = Object.fromEntries(
    Object.entries(defined).filter(([field]) => !replace.includes(field)),
  );
  const replaced = Object.entries(defined).filter(([field]) => replace.includes(field));
  return ok(() => {
    const target = record as Y.Map<unknown>; // записи коллекций создаёт createRecord
    for (const [field, value] of replaced) {
      target.set(field, isPlainObject(value) ? createRecord(value) : value);
    }
    updateRecord(target, merged);
  });
}

/** Выполняет подготовленные изменения одной транзакцией с меткой локальной правки. */
export function commit(doc: Y.Doc, writes: readonly (() => void)[]): void {
  doc.transact(() => {
    writes.forEach((write) => {
      write();
    });
  }, LOCAL_ORIGIN);
}
