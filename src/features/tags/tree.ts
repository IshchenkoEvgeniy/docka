import { TAG_SEPARATOR, resolveTag, tagIdsOf, type Tag, type TagSet } from '../../core';

/**
 * Строка дерева тегов. tag = null — промежуточный родитель: есть «мир/город», а тега «мир»
 * нет; по нему всё равно можно фильтровать (находятся все вложенные).
 */
export interface TagRow {
  readonly name: string;
  readonly tag: Tag | null;
  readonly depth: number;
  readonly leaf: string;
}

/** Живые (не слитые) теги. */
export function realTags(tags: ReadonlyMap<string, Tag>): Tag[] {
  return [...tags.values()]
    .filter((tag) => (tag.mergedInto ?? null) === null)
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** Дерево тегов: по имени, вложенные — сразу под родителем, недостающие родители — строками. */
export function tagRows(tags: ReadonlyMap<string, Tag>): TagRow[] {
  const byName = new Map<string, Tag | null>();
  for (const tag of realTags(tags)) {
    const segments = tag.name.split(TAG_SEPARATOR);
    segments.slice(0, -1).forEach((_, index) => {
      const parent = segments.slice(0, index + 1).join(TAG_SEPARATOR);
      if (!byName.has(parent)) byName.set(parent, null);
    });
    byName.set(tag.name, tag);
  }
  return [...byName.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, tag]) => {
      const segments = name.split(TAG_SEPARATOR);
      return { name, tag, depth: segments.length - 1, leaf: segments.at(-1) ?? name };
    });
}

/** Отмеченные теги записи с учётом слияний, без удалённых и повторов. */
export function liveTags(set: Readonly<TagSet>, tags: ReadonlyMap<string, Tag>): Tag[] {
  const seen = new Map<string, Tag>();
  for (const id of tagIdsOf(set)) {
    const tag = resolveTag(id, tags);
    if (tag !== null) seen.set(tag.id, tag);
  }
  return [...seen.values()].sort((a, b) => a.name.localeCompare(b.name));
}

/** Состояние тега у набора записей: у всех, у части или ни у одной. */
export function tagState(sets: readonly Readonly<TagSet>[], tagId: string): 'on' | 'mixed' | 'off' {
  const marked = sets.filter((set) => set[tagId] === true).length;
  if (marked === 0) return 'off';
  return marked === sets.length ? 'on' : 'mixed';
}
