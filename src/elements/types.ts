import type { ComponentType } from 'react';
import type { z } from 'zod';
import type { ResizeMode, Size } from '../canvas';
import type { BoardElement, RichNode } from '../core';

export type ElementActivation = 'edit' | 'view' | 'open' | null;

/** Данные типа элемента: то, что лежит в `element.data`. */
export type ElementData = Record<string, unknown>;

export interface ElementViewProps<D extends ElementData> {
  readonly element: BoardElement;
  /** `element.data`, уже проверенные схемой типа. */
  readonly data: D;
  /** Идёт правка текста элемента. */
  readonly editing: boolean;
}

/**
 * Описание типа элемента (CLAUDE.md: «реестр элементов»). Новый тип = папка в elements/
 * с таким описанием и строка в registry.ts; холст и сценарии про конкретные типы не знают.
 */
export interface ElementDefinition<D extends ElementData> {
  readonly type: string;
  readonly dataSchema: z.ZodType<D>;
  readonly defaultSize: Size;
  readonly minSize: Size;
  /** 'width' — высота растёт по содержимому. */
  readonly resize: ResizeMode;
  /** Есть форматированный текст (Yjs). */
  readonly richText: boolean;
  /** Что делает двойной щелчок: править текст, открыть на весь экран, войти внутрь (доска). */
  readonly activate: ElementActivation;
  /** Контейнер: в него можно положить другие элементы (колонка). */
  readonly container?: boolean;
  readonly createData: () => D;
  readonly View: ComponentType<ElementViewProps<D>>;
  /** Текст элемента для буфера обмена, поиска и Markdown; rich — текст из Yjs, если есть. */
  readonly toPlainText: (data: D, rich: readonly RichNode[] | null) => string;
  /** Форматированный текст для копирования (у старых заметок — из data). */
  readonly toRichText?: (data: D, rich: readonly RichNode[] | null) => readonly RichNode[];
}

/** Тип элемента после регистрации: данные проверяются внутри, наружу — без дженериков. */
export interface RegisteredElement {
  readonly type: string;
  readonly defaultSize: Size;
  readonly minSize: Size;
  readonly resize: ResizeMode;
  readonly richText: boolean;
  readonly activate: ElementActivation;
  readonly container: boolean;
  readonly createData: () => ElementData;
  /** Содержимое элемента (memo: перерисовывается только при изменении самого элемента). */
  readonly Render: ComponentType<{ readonly element: BoardElement; readonly editing: boolean }>;
  readonly toPlainText: (element: BoardElement, rich: readonly RichNode[] | null) => string;
  /** null — у типа нет текста. */
  readonly toRichText: (
    element: BoardElement,
    rich: readonly RichNode[] | null,
  ) => readonly RichNode[] | null;
}
