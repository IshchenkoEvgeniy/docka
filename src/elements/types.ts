import type { ComponentType } from 'react';
import type { z } from 'zod';
import type { ResizeMode, Size } from '../canvas';
import type { BoardElement, Network, RichNode } from '../core';
import type { AssetStore } from '../data';

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

/** Элемент, созданный из вставленного текста или файла: данные и размер. */
export interface ElementDraft {
  readonly data: Readonly<Record<string, unknown>>;
  readonly width: number;
  readonly height: number;
}

/** Сведения о файле, уже положенном в assets/ проекта. */
export interface StoredFile {
  readonly asset: string;
  readonly name: string;
  readonly mime: string;
  readonly size: number;
}

/** Что нужно типу, чтобы дополнить данные из сети (превью ссылки). */
export interface EnrichTools {
  readonly network: Network;
  readonly assets: AssetStore | null;
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
  /** Название типа для людей (фильтр поиска, подсказки). */
  readonly label: () => string;
  /** Сколько в элементе невыполненных задач (чек-лист); для фильтра поиска. */
  readonly openTasks?: (data: D) => number;
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
  /** Зона холста: двигается с полностью охваченными элементами, пропускает нажатия внутри. */
  readonly region?: boolean;
  /** Новый пустой элемент сразу открывается на правку (по умолчанию — если activate = 'edit'). */
  readonly editOnCreate?: boolean;
  readonly createData: () => D;
  readonly View: ComponentType<ElementViewProps<D>>;
  /** Текст элемента для буфера обмена, поиска и Markdown; rich — текст из Yjs, если есть. */
  readonly toPlainText: (data: D, rich: readonly RichNode[] | null) => string;
  /** Форматированный текст для копирования (у старых заметок — из data). */
  readonly toRichText?: (data: D, rich: readonly RichNode[] | null) => readonly RichNode[];
  readonly target?: (data: D) => OpenTarget;
  /** data того же элемента с другой целью (карточка доски из шаблона — на новую доску). */
  readonly withTarget?: (data: D, targetId: string) => D;
  readonly reference?: EntityReference<D>;
  readonly menuActions?: (data: D) => readonly ElementMenuAction[];
  /** Просмотр на весь экран (activate = 'view'): картинка, PDF. */
  readonly Viewer?: ComponentType<ElementViewProps<D>>;
  /** Распознать вставленный текст (таблица из Excel); null — не этот тип. */
  readonly fromPastedText?: (text: string) => ElementDraft | null;
  /** Дополнить данные из сети (превью ссылки); null — нечего добавить. */
  readonly enrich?: (data: D, tools: EnrichTools) => Promise<Partial<D> | null>;
  /** Файлы, которые кладутся на доску этим типом (видео, любой файл). */
  readonly fromFile?: {
    readonly accepts: (mime: string) => boolean;
    readonly create: (file: StoredFile) => ElementDraft;
  };
}

/** Тип элемента после регистрации: данные проверяются внутри, наружу — без дженериков. */
export interface RegisteredElement {
  readonly type: string;
  readonly label: () => string;
  readonly openTasks: (element: BoardElement) => number;
  readonly defaultSize: Size;
  readonly minSize: Size;
  readonly resize: ResizeMode;
  readonly richText: boolean;
  readonly activate: ElementActivation;
  readonly container: boolean;
  readonly region: boolean;
  readonly editOnCreate: boolean;
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
  readonly withTarget: (
    data: Readonly<Record<string, unknown>>,
    targetId: string,
  ) => Readonly<Record<string, unknown>> | null;
  /** Id сущности, представлением которой служит элемент; null — не сущность. */
  readonly entityOf: (data: Readonly<Record<string, unknown>>) => string | null;
  /** data того же элемента со ссылкой на другую сущность (независимая копия). */
  readonly withEntity: (
    data: Readonly<Record<string, unknown>>,
    entityId: string,
  ) => Readonly<Record<string, unknown>> | null;
  readonly menuActions: (element: BoardElement) => readonly ElementMenuAction[];
  /** Просмотр на весь экран; null — у типа его нет или данные битые. */
  readonly Viewer: ComponentType<{ readonly element: BoardElement }> | null;
  readonly fromPastedText: ((text: string) => ElementDraft | null) | null;
  readonly fromFile: NonNullable<ElementDefinition<ElementData>['fromFile']> | null;
  readonly enrich:
    | ((data: Readonly<Record<string, unknown>>, tools: EnrichTools) => Promise<ElementData | null>)
    | null;
}
