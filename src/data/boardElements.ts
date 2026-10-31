import * as Y from 'yjs';
import type { z } from 'zod';
import {
  ConnectionSchema,
  ElementSchema,
  validate,
  type BoardElement,
  type Connection,
} from '../core';

/**
 * Живой снимок элементов доски для интерфейса. После каждой транзакции перечитываются
 * только изменённые записи: у неизменённых элементов объект остаётся тем же,
 * и React (memo) не перерисовывает их.
 */
export interface LiveRecords<T> {
  /** Записи на доске (без корзины). Новый Map только если что-то изменилось. */
  readonly getSnapshot: () => ReadonlyMap<string, T>;
  /** Сколько записей не прошли проверку (битые данные из файла). */
  readonly invalidCount: () => number;
  readonly subscribe: (listener: () => void) => () => void;
  readonly destroy: () => void;
}

export type BoardElementsStore = LiveRecords<BoardElement>;
export type BoardConnectionsStore = LiveRecords<Connection>;

function readRecord<S extends z.ZodType>(
  collection: Y.Map<unknown>,
  key: string,
  schema: S,
): z.infer<S> | 'missing' | 'invalid' {
  const value = collection.get(key);
  if (value === undefined) return 'missing';
  const plain: unknown = value instanceof Y.AbstractType ? value.toJSON() : value;
  const result = validate(schema, plain);
  return result.ok ? result.value : 'invalid';
}

/** Ключи записей коллекции, затронутые транзакцией (изменения вложенных карт — по первому сегменту пути). */
function changedKeys(
  collection: Y.Map<unknown>,
  events: readonly Y.YEvent<Y.AbstractType<unknown>>[],
) {
  const keys = new Set<string>();
  for (const event of events) {
    if (event.target === collection) {
      event.changes.keys.forEach((_, key) => keys.add(key));
      continue;
    }
    const [first] = event.path;
    if (typeof first === 'string') keys.add(first);
  }
  return keys;
}

function createLiveRecords<S extends z.ZodType<{ readonly deletedAt: number | null }>>(
  collection: Y.Map<unknown>,
  schema: S,
): LiveRecords<z.infer<S>> {
  type Item = z.infer<S>;
  let snapshot = new Map<string, Item>();
  const invalid = new Set<string>();
  const listeners = new Set<() => void>();

  const apply = (keys: Iterable<string>, target: Map<string, Item>): void => {
    for (const key of keys) {
      const record = readRecord(collection, key, schema);
      target.delete(key);
      invalid.delete(key);
      if (record === 'invalid') invalid.add(key);
      else if (record !== 'missing' && record.deletedAt === null) target.set(key, record);
    }
  };

  apply(collection.keys(), snapshot);

  const observer = (events: Y.YEvent<Y.AbstractType<unknown>>[]): void => {
    const next = new Map(snapshot);
    apply(changedKeys(collection, events), next);
    snapshot = next;
    listeners.forEach((listener) => {
      listener();
    });
  };
  collection.observeDeep(observer);

  return {
    getSnapshot: () => snapshot,
    invalidCount: () => invalid.size,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    destroy: () => {
      collection.unobserveDeep(observer);
      listeners.clear();
    },
  };
}

export function createBoardElementsStore(doc: Y.Doc): BoardElementsStore {
  return createLiveRecords(doc.getMap<unknown>('elements'), ElementSchema);
}

/** Стрелки доски — так же, как элементы: перечитываются только изменённые. */
export function createBoardConnectionsStore(doc: Y.Doc): BoardConnectionsStore {
  return createLiveRecords(doc.getMap<unknown>('connections'), ConnectionSchema);
}
