import { z } from 'zod';
import { ColorNameSchema } from './color';
import { BoardIdSchema, ElementIdSchema, TagIdSchema, TimestampSchema } from './ids';

/** Пределы размеров и координат: защищают от мусора в файлах (NaN, бесконечность, гигантские числа). */
const COORDINATE_LIMIT = 10_000_000;
const coordinate = z.number().min(-COORDINATE_LIMIT).max(COORDINATE_LIMIT);
const size = z.number().positive().max(100_000);

/** Тип элемента: имя из реестра элементов (`note`, `image`, `column`…). Сам реестр — в слое elements. */
export const ElementTypeSchema = z.string().regex(/^[a-z][a-z0-9-]{0,31}$/);

/**
 * Общая часть любого элемента доски. Специфичные поля типа лежат в `data`
 * и проверяются схемой из определения элемента (шаг 2.2).
 */
export const ElementSchema = z.object({
  id: ElementIdSchema,
  boardId: BoardIdSchema,
  type: ElementTypeSchema,
  /** Левый верхний угол в мировых координатах. */
  x: coordinate,
  y: coordinate,
  width: size,
  /** Последняя известная высота: нужна для отсечения невидимого и обзора (ADR 0001). */
  height: size,
  /** Порядок наложения; при равенстве выше элемент с большим id. */
  z: z.number(),
  /** Контейнер (колонка), в котором лежит элемент; null — прямо на доске. */
  parentId: ElementIdSchema.nullable(),
  color: ColorNameSchema,
  locked: z.boolean(),
  tagIds: z.array(TagIdSchema),
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
  /** Момент удаления в корзину; null — элемент на доске. */
  deletedAt: TimestampSchema.nullable(),
  data: z.record(z.string(), z.unknown()),
});
export type BoardElement = z.infer<typeof ElementSchema>;

/** Порядок отрисовки: по z, при равенстве — по id, чтобы порядок был одинаковым на всех устройствах. */
export function compareStacking(
  a: { readonly z: number; readonly id: string },
  b: { readonly z: number; readonly id: string },
): number {
  if (a.z !== b.z) return a.z - b.z;
  if (a.id === b.id) return 0;
  return a.id < b.id ? -1 : 1;
}
