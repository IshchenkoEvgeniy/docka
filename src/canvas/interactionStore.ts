import { createStore, type StoreApi } from 'zustand/vanilla';
import { useStore } from 'zustand';
import type { Point, Rect } from './geometry';

/** Направляющая выравнивания: вертикальная (axis 'x') или горизонтальная линия в мировых координатах. */
export interface Guide {
  readonly axis: 'x' | 'y';
  readonly position: number;
  readonly from: number;
  readonly to: number;
}

/**
 * Эфемерное состояние работы с холстом (CLAUDE.md: только UI, данные документа сюда не копируются).
 * Во время перетаскивания меняется только оно; в документ изменения уходят одной командой в конце.
 */
export interface InteractionState {
  readonly selection: ReadonlySet<string>;
  /** Перетаскиваемые элементы, смещение от исходных позиций, контейнер под ними. */
  readonly drag: {
    readonly ids: ReadonlySet<string>;
    readonly dx: number;
    readonly dy: number;
    /** Контейнеры, из которых тянут карточки: их поднимают над соседями. */
    readonly raise: ReadonlySet<string>;
    /** Колонка, куда упадут элементы, если отпустить сейчас. */
    readonly target: string | null;
  } | null;
  /** Элемент, размер которого меняется, и его будущий прямоугольник. */
  readonly resize: { readonly id: string; readonly rect: Rect } | null;
  readonly marquee: Rect | null;
  readonly guides: readonly Guide[];
  /** Элемент, текст которого сейчас редактируется. */
  readonly editingId: string | null;
  /** Выделенные стрелки (отдельно от элементов). */
  readonly connectionSelection: ReadonlySet<string>;
  /** Проводимая стрелка: от элемента к точке, над каким элементом указатель. */
  readonly connecting: {
    readonly from: string;
    readonly to: Point;
    readonly hoverId: string | null;
  } | null;
}

export type InteractionStore = StoreApi<InteractionState>;

export const EMPTY_SELECTION: ReadonlySet<string> = new Set();

export function createInteractionStore(): InteractionStore {
  return createStore<InteractionState>(() => ({
    selection: EMPTY_SELECTION,
    drag: null,
    resize: null,
    marquee: null,
    guides: [],
    editingId: null,
    connectionSelection: EMPTY_SELECTION,
    connecting: null,
  }));
}

export function useInteraction<T>(
  store: InteractionStore,
  selector: (state: InteractionState) => T,
): T {
  return useStore(store, selector);
}
