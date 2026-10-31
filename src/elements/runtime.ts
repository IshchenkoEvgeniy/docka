import { createContext, useContext, type ComponentType } from 'react';
import type * as Y from 'yjs';
import type { BoardElement, RichNode } from '../core';
import type { AssetStore, BoardElementsStore } from '../data';

/**
 * Что элементам нужно от открытой доски: текст в Yjs, отмена, завершение правки,
 * измеренная высота. Даёт сценарий доски (features/board) через контекст.
 */
export interface ElementRuntime {
  /** Текст элемента или null (старая заметка, где был только data.text). */
  readonly textOf: (elementId: string) => Y.XmlFragment | null;
  /** Текст для редактирования; если его нет — создаётся из initial. */
  readonly ensureText: (elementId: string, initial: readonly RichNode[]) => Y.XmlFragment | null;
  readonly stopEditing: () => void;
  /** Узкий экран (телефон): текст правится на весь экран, а не в маленькой карточке. */
  readonly fullscreenEditing: boolean;
  readonly undo: () => void;
  readonly redo: () => void;
  /** Файлы проекта (картинки); null — доска без проекта. */
  readonly assets: AssetStore | null;
  readonly boards: BoardDirectory | null;
  /** Все элементы доски (колонке — чтобы найти свои карточки). */
  readonly elements: Pick<BoardElementsStore, 'subscribe' | 'getSnapshot'>;
  /** Карточка внутри контейнера: выделение, перетаскивание и правка — как на доске. */
  readonly ChildView: ComponentType<{ readonly element: BoardElement }>;
  /** Изменить поля data элемента (свернуть колонку, отметить пункт). */
  readonly updateData: (elementId: string, changes: Readonly<Record<string, unknown>>) => void;
  /** Высота содержимого изменилась (растёт текст): доска решает, записать ли её. */
  readonly reportHeight: (elementId: string, height: number) => void;
}

/** Доски проекта для карточек досок: название и удалена ли. */
export interface BoardDirectory {
  readonly subscribe: (listener: () => void) => () => void;
  readonly get: (boardId: string) => { readonly title: string; readonly deleted: boolean } | null;
}

export const ElementRuntimeContext = createContext<ElementRuntime | null>(null);

export function useElementRuntime(): ElementRuntime {
  const runtime = useContext(ElementRuntimeContext);
  if (runtime === null) throw new Error('Элемент показан вне доски (нет ElementRuntimeContext)');
  return runtime;
}
