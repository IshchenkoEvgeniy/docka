import { boardPath } from './board';
import type { BoardId, Timestamp } from './ids';

/** Сколько удалённое лежит в корзине до окончательного удаления (ТЗ, раздел 3). */
export const TRASH_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

/** Пора ли удалить запись из корзины окончательно. */
export function isTrashExpired(deletedAt: Timestamp | null, now: Timestamp): boolean {
  return deletedAt !== null && now - deletedAt >= TRASH_RETENTION_MS;
}

/** Доска в корзине — если удалена она сама или любая доска выше неё. */
export function isBoardInTrash(
  boardId: BoardId,
  parentOf: (id: BoardId) => BoardId | null | undefined,
  deletedAtOf: (id: BoardId) => Timestamp | null | undefined,
): boolean {
  return boardPath(boardId, parentOf).some((id) => {
    const deletedAt = deletedAtOf(id);
    return deletedAt !== null && deletedAt !== undefined;
  });
}
