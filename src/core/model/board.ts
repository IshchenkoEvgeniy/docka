import { z } from 'zod';
import { ColorNameSchema } from './color';
import { BoardIdSchema, TimestampSchema, type BoardId } from './ids';

export const BOARD_BACKGROUNDS = ['plain', 'dots', 'grid'] as const;
export type BoardBackground = (typeof BOARD_BACKGROUNDS)[number];

export const BoardSchema = z.object({
  id: BoardIdSchema,
  title: z.string().max(200),
  /** null — корневая доска проекта. */
  parentId: BoardIdSchema.nullable(),
  icon: z.string().max(32).nullable(),
  color: ColorNameSchema,
  background: z.enum(BOARD_BACKGROUNDS),
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
  /** Момент удаления в корзину; null — доска не удалена. Вложенные доски скрыты вместе с ней. */
  deletedAt: TimestampSchema.nullable(),
});
export type Board = z.infer<typeof BoardSchema>;

type ParentLookup = (id: BoardId) => BoardId | null | undefined;

/**
 * Путь от корня до доски включительно (для хлебных крошек).
 * Если дерево повреждено (цикл или ссылка на несуществующую доску), путь обрывается на проблеме.
 */
export function boardPath(id: BoardId, parentOf: ParentLookup): BoardId[] {
  const path: BoardId[] = [];
  const seen = new Set<BoardId>();
  let current: BoardId | null | undefined = id;
  while (current !== null && current !== undefined && !seen.has(current)) {
    seen.add(current);
    path.unshift(current);
    current = parentOf(current);
  }
  return path;
}

/** Создаст ли перенос доски внутрь newParent цикл (доска внутри самой себя или своей потомка). */
export function wouldCreateCycle(
  board: BoardId,
  newParent: BoardId,
  parentOf: ParentLookup,
): boolean {
  return boardPath(newParent, parentOf).includes(board);
}
