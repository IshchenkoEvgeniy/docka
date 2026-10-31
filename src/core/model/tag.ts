import { z } from 'zod';
import { ColorNameSchema } from './color';
import { TagIdSchema } from './ids';

/** Разделитель вложенных тегов: «баг/критичный». */
export const TAG_SEPARATOR = '/';

/** Приводит имя тега к единому виду: без пробелов по краям сегментов и без пустых сегментов. */
export function normalizeTagName(name: string): string {
  return name
    .split(TAG_SEPARATOR)
    .map((segment) => segment.trim().replace(/\s+/g, ' '))
    .filter((segment) => segment !== '')
    .join(TAG_SEPARATOR);
}

/** Сам тег и все его родители: «a/b/c» → ['a', 'a/b', 'a/b/c']. Для фильтра по родительскому тегу. */
export function tagWithAncestors(name: string): string[] {
  const segments = normalizeTagName(name).split(TAG_SEPARATOR);
  return segments.map((_, index) => segments.slice(0, index + 1).join(TAG_SEPARATOR));
}

export const TagSchema = z.object({
  id: TagIdSchema,
  name: z.string().transform(normalizeTagName).pipe(z.string().min(1).max(100)),
  color: ColorNameSchema,
  /** Тег слит с другим (ADR 0006): ссылки на него читаются как ссылки на целевой. */
  mergedInto: TagIdSchema.nullable().optional(),
});
export type Tag = z.infer<typeof TagSchema>;

/**
 * Теги записи — множество `id → true/false` (ADR 0006): отметки с разных устройств сливаются,
 * снятая отметка не воскресает.
 */
export const TagSetSchema = z.record(z.string(), z.boolean());
export type TagSet = z.infer<typeof TagSetSchema>;

/** Отмеченные id тегов. */
export function tagIdsOf(set: Readonly<TagSet>): string[] {
  return Object.entries(set)
    .filter(([, on]) => on)
    .map(([id]) => id);
}

/** Тег с учётом слияний; null — тега нет (удалён) или цепочка слияний битая. */
export function resolveTag(id: string, byId: ReadonlyMap<string, Tag>): Tag | null {
  let current = byId.get(id);
  for (let hops = 0; current?.mergedInto !== undefined && current.mergedInto !== null; hops += 1) {
    if (hops > 16) return null;
    current = byId.get(current.mergedInto);
  }
  return current ?? null;
}

/**
 * Есть ли среди тегов записи тег с именем filter или вложенный в него («баг» находит
 * «баг/критичный», даже если отдельного тега «баг» нет). Слитые теги — по целевому.
 */
export function hasTag(
  ids: Iterable<string>,
  filter: string,
  byId: ReadonlyMap<string, Tag>,
): boolean {
  for (const id of ids) {
    const name = resolveTag(id, byId)?.name;
    if (name === filter || name?.startsWith(`${filter}${TAG_SEPARATOR}`) === true) return true;
  }
  return false;
}
