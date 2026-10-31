import type { ComponentType } from 'react';
import type { z } from 'zod';
import type { ResizeMode, Size } from '../canvas';
import type { BoardElement, RichNode } from '../core';

export type ElementActivation = 'edit' | 'view' | 'open' | null;

/** Данные типа элемента: то, что лежит в `element.data`. */
export type ElementData = Record<string, unknown>;

/** Что открывает элемент с activate = 'open': доску или сущность проекта. */
export type OpenTarget =
  | { readonly kind: 'board'; readonly id: string }
  | { readonly kind: 'entity'; readonly id: string };

/** Пункт меню элемента, меняющий его data (например, вид карточки сущности). */
export interface ElementMenuAction {
  readonly id: string;
  readonly label: string;
  /** Отметка у выбранного варианта. */
  readonly checked: boolean;
  readonly changes: Readonly<Record<string, unknown>>;
}

/** Элемент — представление сущности проекта: для подсчёта мест и выбора «ссылка или копия». */
export interface EntityReference<D> {
  readonly entityId: (data: D) => string;
  readonly withEntity: (data: D, entityId: string) => D;
}

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
  readonly target?: (data: D) => OpenTarget;
  readonly reference?: EntityReference<D>;
  readonly menuActions?: (data: D) => readonly ElementMenuAction[];
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
  /** Что открыть двойным щелчком (activate = 'open'); null — нечего. */
  readonly target: (element: BoardElement) => OpenTarget | null;
  /** Id сущности, представлением которой служит элемент; null — не сущность. */
  readonly entityOf: (data: Readonly<Record<string, unknown>>) => string | null;
  /** data того же элемента со ссылкой на другую сущность (независимая копия). */
  readonly withEntity: (
    data: Readonly<Record<string, unknown>>,
    entityId: string,
  ) => Readonly<Record<string, unknown>> | null;
  readonly menuActions: (element: BoardElement) => readonly ElementMenuAction[];
}
