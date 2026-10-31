import type {
  BoardId,
  ColorName,
  ConnectionId,
  ElementId,
  Endpoint,
  RichNode,
  TagId,
} from '../model';
import type { BOARD_BACKGROUNDS } from '../model/board';
import type { LINE_STYLES, MARKERS } from '../model/connection';
import type { EntityCommand } from './entityCommands';

/**
 * Команды — единственный способ менять данные (CLAUDE.md). Здесь — их описания,
 * без Yjs; выполняет их слой data в одной транзакции, одна команда = один шаг отмены.
 */

type Background = (typeof BOARD_BACKGROUNDS)[number];
type LineStyle = (typeof LINE_STYLES)[number];
type Marker = (typeof MARKERS)[number];

/** Команды документа проекта: дерево досок, теги, название, сущности. */
export type ProjectCommand =
  | EntityCommand
  | { readonly kind: 'renameProject'; readonly name: string }
  | { readonly kind: 'createBoard'; readonly parentId: BoardId; readonly title: string }
  | {
      readonly kind: 'updateBoard';
      readonly boardId: BoardId;
      readonly changes: {
        readonly title?: string;
        readonly icon?: string | null;
        readonly color?: ColorName;
        readonly background?: Background;
        /** Отметки тегов: `{ id тега: true/false }` (ADR 0006). */
        readonly tags?: Readonly<Record<string, boolean>>;
      };
    }
  | { readonly kind: 'moveBoard'; readonly boardId: BoardId; readonly newParentId: BoardId }
  | { readonly kind: 'createTag'; readonly name: string; readonly color: ColorName }
  /** В корзину: доска и всё, что в ней. Корень проекта удалить нельзя. */
  | { readonly kind: 'deleteBoard'; readonly boardId: BoardId }
  /** Из корзины; если доска выше тоже удалена — восстановленная доска переносится в корень. */
  | { readonly kind: 'restoreBoard'; readonly boardId: BoardId }
  /** Тег удаляется сразу (без корзины); отменяется обычной отменой. */
  | { readonly kind: 'deleteTag'; readonly tagId: TagId }
  /** Переименование меняет и вложенные теги («баг» → «ошибка»: «баг/x» → «ошибка/x»). */
  | {
      readonly kind: 'updateTag';
      readonly tagId: TagId;
      readonly changes: { readonly name?: string; readonly color?: ColorName };
    }
  /** Слияние: ссылки на tagId читаются как ссылки на intoId (ADR 0006). */
  | { readonly kind: 'mergeTags'; readonly tagId: TagId; readonly intoId: TagId }
  /** «Удалить шаблон»: файл остаётся, шаблон скрывается во всех устройствах (ADR 0006). */
  | { readonly kind: 'removeTemplate'; readonly templateId: string };

export interface ElementPlacement {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/** Описание нового элемента (одного или из пачки — например, при вставке). */
export interface NewElement {
  readonly type: string;
  readonly placement: ElementPlacement;
  readonly color?: ColorName;
  readonly parentId?: ElementId | null;
  /** Контейнер из этой же пачки (номер в списке, раньше этого элемента): вставка колонки с карточками. */
  readonly parentIndex?: number;
  readonly locked?: boolean;
  readonly tagIds?: readonly TagId[];
  readonly data: Readonly<Record<string, unknown>>;
  /** Форматированный текст (заметка, заголовок): ляжет в Yjs отдельным полем `text`. */
  readonly richText?: readonly RichNode[];
}

/** Команды документа доски: элементы и связи. */
export type BoardCommand =
  | ({ readonly kind: 'createElement' } & NewElement)
  /** Несколько элементов одним шагом отмены, в порядке наложения снизу вверх (вставка, дублирование). */
  | { readonly kind: 'createElements'; readonly elements: readonly NewElement[] }
  | {
      readonly kind: 'updateElement';
      readonly elementId: ElementId;
      readonly changes: {
        readonly color?: ColorName;
        readonly locked?: boolean;
        /** Отметки тегов: `{ id тега: true/false }` (ADR 0006). */
        readonly tags?: Readonly<Record<string, boolean>>;
        readonly parentId?: ElementId | null;
        /** Меняются только перечисленные поля data, остальные сохраняются. */
        readonly data?: Readonly<Record<string, unknown>>;
      };
    }
  /** Одинаковая правка нескольких элементов одним шагом (закрепить выделенное, перекрасить). */
  | {
      readonly kind: 'updateElements';
      readonly elementIds: readonly ElementId[];
      readonly changes: {
        readonly color?: ColorName;
        readonly locked?: boolean;
        readonly tags?: Readonly<Record<string, boolean>>;
      };
    }
  | {
      readonly kind: 'moveElements';
      readonly moves: readonly {
        readonly elementId: ElementId;
        readonly x: number;
        readonly y: number;
      }[];
    }
  /** Перенос с возможной сменой контейнера: положить в колонку или вынуть из неё. */
  | {
      readonly kind: 'placeElements';
      readonly placements: readonly {
        readonly elementId: ElementId;
        readonly x: number;
        readonly y: number;
        readonly parentId: ElementId | null;
      }[];
    }
  | {
      readonly kind: 'resizeElement';
      readonly elementId: ElementId;
      readonly placement: ElementPlacement;
    }
  | {
      readonly kind: 'reorderElements';
      readonly elementIds: readonly ElementId[];
      readonly to: 'front' | 'back';
    }
  /** В корзину вместе с содержимым колонок и привязанными стрелками. */
  | { readonly kind: 'deleteElements'; readonly elementIds: readonly ElementId[] }
  /** Из корзины вместе с тем, что было удалено вместе с ними. */
  | { readonly kind: 'restoreElements'; readonly elementIds: readonly ElementId[] }
  | { readonly kind: 'deleteConnections'; readonly connectionIds: readonly ConnectionId[] }
  | { readonly kind: 'restoreConnections'; readonly connectionIds: readonly ConnectionId[] }
  | {
      readonly kind: 'createConnection';
      readonly from: Endpoint;
      readonly to: Endpoint;
      readonly style?: ConnectionStyle;
    }
  | {
      readonly kind: 'updateConnection';
      readonly connectionId: ConnectionId;
      readonly changes: ConnectionStyle & {
        readonly from?: Endpoint;
        readonly to?: Endpoint;
      };
    };

export interface ConnectionStyle {
  readonly label?: string;
  readonly color?: ColorName;
  readonly lineStyle?: LineStyle;
  readonly startMarker?: Marker;
  readonly endMarker?: Marker;
}

/** Что создала команда (id новой доски, элемента…), чтобы интерфейс мог его выделить. */
export interface CommandResult {
  readonly createdId?: string;
  /** Для команд, создающих несколько записей, — в том же порядке. */
  readonly createdIds?: readonly string[];
}
