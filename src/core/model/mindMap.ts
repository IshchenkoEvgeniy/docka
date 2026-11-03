import { z } from 'zod';
import { ElementIdSchema } from './ids';

/** Направление ветвей карты; хранится у корня (ADR 0011). */
export const MIND_MAP_DIRECTIONS = ['right', 'both', 'down'] as const;
export type MindMapDirection = (typeof MIND_MAP_DIRECTIONS)[number];

/** Сторона ветки корня в режиме «в обе стороны». */
export const MIND_MAP_SIDES = ['left', 'right'] as const;
export type MindMapSide = (typeof MIND_MAP_SIDES)[number];

/** Тот же предел, что у координат элемента: защита от мусора в файлах. */
const OFFSET_LIMIT = 10_000_000;
const offsetComponent = z.number().min(-OFFSET_LIMIT).max(OFFSET_LIMIT);

/**
 * Место элемента в майнд-карте (поле `tree` элемента, ADR 0011).
 * `parentId` null — корень карты.
 */
export const MindMapLinkSchema = z.object({
  parentId: ElementIdSchema.nullable(),
  order: z.number(),
  collapsed: z.boolean(),
  /** Ручной сдвиг узла вместе с веткой от вычисленной позиции; null — без сдвига. */
  offset: z.object({ dx: offsetComponent, dy: offsetComponent }).nullable(),
  direction: z.enum(MIND_MAP_DIRECTIONS).optional(),
  side: z.enum(MIND_MAP_SIDES).optional(),
});
export type MindMapLink = z.infer<typeof MindMapLinkSchema>;

/**
 * Место в карте внутри пачки новых элементов (буфер обмена, шаблон, список): родитель —
 * номер в той же пачке; нет родителя — корень новой карты. Сдвиги не переносятся.
 */
export const MindMapPlacementSchema = z.object({
  parentIndex: z.number().int().nonnegative().optional(),
  order: z.number(),
  collapsed: z.boolean(),
  direction: z.enum(MIND_MAP_DIRECTIONS).optional(),
  side: z.enum(MIND_MAP_SIDES).optional(),
});
export type MindMapPlacement = z.infer<typeof MindMapPlacementSchema>;
