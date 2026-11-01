import type { ComponentType } from 'react';
import type { BoardBackground, BoardId, ClipboardReader, FileSaver, Network } from '../../core';
import type { AssetStore, UndoHistory } from '../../data';
import type { BoardDirectory, LinkedBoardPreviewProps } from '../../elements';
import type { ProjectTags } from '../tags';
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
  readonly readClipboard: ClipboardReader | null;
  readonly BoardPreview?: ComponentType<LinkedBoardPreviewProps>;
  readonly saveFile: FileSaver | null;
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
  /** Теги проекта; null — доска без проекта. */
  readonly tags: ProjectTags | null;
  readonly openTagManager: () => void;
  /** Теги самой доски (окно выбора тегов проекта). */
  readonly editBoardTags: () => void;
  /** «Сохранить доску как шаблон». */
  readonly saveAsTemplate: () => void;
  /** Окно поиска по проекту (Ctrl+K). */
  readonly openSearch: () => void;
  /** Элемент, к которому перейти после открытия доски (результат поиска). */
  readonly focus: {
    readonly take: (boardId: string) => string | null;
    readonly subscribe: (listener: () => void) => () => void;
  } | null;
  /** Полученное через «Поделиться»: открытая доска забирает его себе. */
  readonly inbox: BoardFeed<SharedItem> | null;
}

export const NO_HOST: BoardHost = {
  readClipboard: null,
  saveFile: null,
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
  openSearch: () => undefined,
  saveAsTemplate: () => undefined,
  focus: null,
  tags: null,
  openTagManager: () => undefined,
  editBoardTags: () => undefined,
  inbox: null,
};
