import type { Camera, GestureHandlers, Point, PointerTarget, Rect } from '../../canvas';
import type { BoardModel } from './model';

/** Что нужно жестам от окна: камера, видимая область, размеры элементов на экране, меню. */
export interface GestureView {
  readonly getCamera: () => Camera;
  readonly getVisibleRect: () => Rect | null;
  /** Прямоугольник элемента в мире по DOM (карточки в колонке и элементы с высотой по тексту). */
  readonly measure: (elementId: string) => Rect | null;
  readonly openMenu: (target: PointerTarget, screen: Point) => void;
}

export interface GestureContext {
  readonly model: BoardModel;
  readonly view: GestureView;
  readonly selection: () => ReadonlySet<string>;
  readonly gridSnap: () => boolean;
}

export type HandlersPart<K extends keyof GestureHandlers> = Pick<GestureHandlers, K>;
