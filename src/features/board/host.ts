import type { BoardBackground, BoardId, Network } from '../../core';
import type { AssetStore, UndoHistory } from '../../data';
import type { BoardDirectory } from '../../elements';
import type { SharedItem } from '../workspace';
import type { ClipboardPayload } from './clipboard';

/** Поступающее на доску извне (общий вид для «Поделиться» и «На доску» из библиотеки). */
export interface BoardFeed<T> {
  readonly take: () => readonly T[];
  readonly subscribe: (listener: () => void) => () => void;
}

/** Сущности проекта, на которые ссылаются элементы доски (ADR 0004). */
export interface BoardEntities {
  readonly exists: (entityId: string) => boolean;
  /** Независимая копия; null — не удалось. */
  readonly duplicate: (entityId: string) => string | null;
  /** История отмены правок сущностей: на доске она общая с историей доски. */
  readonly history: UndoHistory;
  readonly openLibrary: () => void;
}

/**
 * Что доске нужно от проекта: файлы проекта (картинки) и переход в другую доску.
 * Без проекта (тесты, замер) всё это может отсутствовать.
 */
export interface BoardHost {
  readonly assets: AssetStore | null;
  readonly boards: BoardDirectory | null;
  readonly openBoard: (boardId: BoardId) => void;
  readonly openEntity: (entityId: string) => void;
  readonly entities: BoardEntities | null;
  /** Элементы, отправленные на доску из библиотеки (телефон: «На доску»). */
  readonly placements: BoardFeed<ClipboardPayload> | null;
  /** Новая доска внутри текущей; null — нельзя (нет проекта). */
  readonly createBoard: () => BoardId | null;
  /** Предложить название только что созданной доски. */
  readonly renameBoard: (boardId: BoardId) => void;
  readonly setBackground: (background: BoardBackground) => void;
  /** Сеть для превью ссылок; null — недоступна. */
  readonly network: Network | null;
  /** Файл проекта — системной программой; null — нельзя. */
  readonly openAsset: ((asset: string, mime: string) => Promise<void>) | null;
  readonly openUrl: (url: string) => Promise<void>;
  /** Полученное через «Поделиться»: открытая доска забирает его себе. */
  readonly inbox: BoardFeed<SharedItem> | null;
}

export const NO_HOST: BoardHost = {
  assets: null,
  boards: null,
  openBoard: () => undefined,
  openEntity: () => undefined,
  entities: null,
  placements: null,
  createBoard: () => null,
  renameBoard: () => undefined,
  setBackground: () => undefined,
  network: null,
  openAsset: null,
  openUrl: () => Promise.resolve(),
  inbox: null,
};
