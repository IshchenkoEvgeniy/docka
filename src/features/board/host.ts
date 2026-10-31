import type { BoardBackground, BoardId } from '../../core';
import type { AssetStore } from '../../data';
import type { BoardDirectory } from '../../elements';
import type { SharedItem } from '../workspace';

/**
 * Что доске нужно от проекта: файлы проекта (картинки) и переход в другую доску.
 * Без проекта (тесты, замер) всё это может отсутствовать.
 */
export interface BoardHost {
  readonly assets: AssetStore | null;
  readonly boards: BoardDirectory | null;
  readonly openBoard: (boardId: BoardId) => void;
  /** Новая доска внутри текущей; null — нельзя (нет проекта). */
  readonly createBoard: () => BoardId | null;
  /** Предложить название только что созданной доски. */
  readonly renameBoard: (boardId: BoardId) => void;
  readonly setBackground: (background: BoardBackground) => void;
  /** Полученное через «Поделиться»: открытая доска забирает его себе. */
  readonly inbox: {
    readonly take: () => readonly SharedItem[];
    readonly subscribe: (listener: () => void) => () => void;
  } | null;
}

export const NO_HOST: BoardHost = {
  assets: null,
  boards: null,
  openBoard: () => undefined,
  createBoard: () => null,
  renameBoard: () => undefined,
  setBackground: () => undefined,
  inbox: null,
};
