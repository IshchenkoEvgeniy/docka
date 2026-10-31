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
});
export type Tag = z.infer<typeof TagSchema>;
