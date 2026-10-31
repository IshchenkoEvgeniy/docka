import type * as Y from 'yjs';
import { err, ok, type Result } from '../core';

/**
 * Миграции формата проекта (docs/format.md, раздел «Версии и миграции»).
 *
 * Версия хранится в project.json (`formatVersion`) и в каждом Yjs-документе (`format.version`).
 * Документы досок мигрируют при открытии. Миграция документа обязана быть идемпотентной:
 * два устройства могут выполнить её одновременно, Yjs сольёт результаты.
 */
export interface Migration {
  /** Версия, к которой приводит миграция (предыдущая — version - 1). */
  readonly version: number;
  readonly description: string;
  /** Изменение project.json (чистая функция над JSON). */
  readonly migrateMeta?: (meta: Readonly<Record<string, unknown>>) => Record<string, unknown>;
  readonly migrateProjectDoc?: (doc: Y.Doc) => void;
  readonly migrateBoardDoc?: (doc: Y.Doc) => void;
}

/** Миграции приложения по порядку. Формат 1 — первый, миграций пока нет. */
export const MIGRATIONS: readonly Migration[] = [];

/** Метка транзакций миграции: пишутся в журнал, не отменяются «Отменить». */
export const MIGRATION_ORIGIN = Symbol('migration');

/**
 * Отметки версий в документе: карта `format` с ключами `v1`, `v2`… Версия — наибольшая отметка.
 * Не одно поле `version`: при одновременной записи с двух устройств Yjs оставил бы одно значение,
 * и «1» со старого устройства могла бы победить «3» с нового. Отметки объединяются — версия
 * при слиянии только растёт.
 */
const FORMAT_MAP = 'format';
const stampKey = (version: number) => `v${String(version)}`;
/** Документ без отметки версии создан форматом 1 (версии в документах появились вместе с ним). */
const UNVERSIONED = 1;

/** Цепочка миграций непрерывна: для каждой версии от 2 до current есть ровно одна миграция. */
export function checkMigrationChain(
  migrations: readonly Migration[],
  current: number,
): Result<true> {
  for (let version = 2; version <= current; version += 1) {
    const count = migrations.filter((migration) => migration.version === version).length;
    if (count !== 1)
      return err(`Нет миграции (или их несколько) к версии формата ${String(version)}`);
  }
  if (migrations.some((migration) => migration.version > current || migration.version < 2)) {
    return err('Есть миграция вне диапазона версий формата');
  }
  return ok(true);
}

function stepsBetween(migrations: readonly Migration[], from: number, to: number): Migration[] {
  return migrations
    .filter((m) => m.version > from && m.version <= to)
    .sort((a, b) => a.version - b.version);
}

export function documentFormatVersion(doc: Y.Doc): number {
  let version = UNVERSIONED;
  for (const key of doc.getMap<unknown>(FORMAT_MAP).keys()) {
    const match = /^v(\d+)$/.exec(key);
    if (match?.[1] !== undefined) version = Math.max(version, Number(match[1]));
  }
  return version;
}

/**
 * Приводит документ к текущей версии. Возвращает false, если документ новее приложения
 * (тогда он не трогается). Отметка версии ставится и на новых документах.
 */
export function migrateDocument(
  doc: Y.Doc,
  kind: 'project' | 'board',
  migrations: readonly Migration[],
  current: number,
): boolean {
  const from = documentFormatVersion(doc);
  if (from > current) return false;
  if (from === current && doc.getMap<unknown>(FORMAT_MAP).has(stampKey(current))) return true;
  doc.transact(() => {
    for (const migration of stepsBetween(migrations, from, current)) {
      if (kind === 'project') migration.migrateProjectDoc?.(doc);
      else migration.migrateBoardDoc?.(doc);
    }
    doc.getMap<unknown>(FORMAT_MAP).set(stampKey(current), true);
  }, MIGRATION_ORIGIN);
  return true;
}

/** Приводит JSON project.json от версии from к current. */
export function migrateMeta(
  meta: Readonly<Record<string, unknown>>,
  from: number,
  migrations: readonly Migration[],
  current: number,
): Record<string, unknown> {
  let result: Record<string, unknown> = { ...meta };
  for (const migration of stepsBetween(migrations, from, current)) {
    result = { ...(migration.migrateMeta?.(result) ?? result), formatVersion: migration.version };
  }
  return result;
}
