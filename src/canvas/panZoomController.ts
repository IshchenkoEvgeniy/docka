import { panBy, zoomAt, type Camera, type Point } from './camera';

/**
 * Пан и зум холста без привязки к DOM: на вход — нормализованные события указателя и колеса,
 * на выход — новая камера через onChange. DOM-обвязка живёт в useCameraControls.
 *
 * Правила (ТЗ, раздел 4):
 * - мышь: пан средней кнопкой или левой с зажатым пробелом; Ctrl + колесо — зум к курсору;
 *   колесо без Ctrl — прокрутка (тачпад двумя пальцами);
 * - палец и стилус: пан по пустому месту одним касанием, щипок двумя пальцами — зум.
 */

export type PointerKind = 'mouse' | 'touch' | 'pen';

export interface PointerDownInput {
  readonly id: number;
  readonly kind: PointerKind;
  readonly button: number;
  readonly point: Point;
  /** Касание пришлось на пустое место холста, а не на элемент. */
  readonly onBackground: boolean;
}

export interface WheelInput {
  readonly point: Point;
  readonly deltaX: number;
  readonly deltaY: number;
  /** 0 — пиксели, 1 — строки, 2 — страницы (WheelEvent.deltaMode). */
  readonly deltaMode: number;
  readonly ctrlKey: boolean;
  readonly shiftKey: boolean;
}

export interface PanZoomController {
  /** Возвращает true, если жест захвачен и указатель нужно удерживать за холстом. */
  readonly pointerDown: (input: PointerDownInput) => boolean;
  readonly pointerMove: (id: number, point: Point) => void;
  readonly pointerUp: (id: number) => void;
  readonly wheel: (input: WheelInput) => void;
  readonly setSpaceHeld: (held: boolean) => void;
  readonly getCamera: () => Camera;
  readonly setCamera: (camera: Camera) => void;
}

const MIDDLE_BUTTON = 1;
const LEFT_BUTTON = 0;
const LINE_HEIGHT_PX = 16;
const PAGE_HEIGHT_PX = 800;
/** Чувствительность зума колесом: 100 px прокрутки ≈ ×1.65. */
const WHEEL_ZOOM_SPEED = 0.005;

function normalizeDelta(delta: number, deltaMode: number): number {
  if (deltaMode === 1) return delta * LINE_HEIGHT_PX;
  if (deltaMode === 2) return delta * PAGE_HEIGHT_PX;
  return delta;
}

function startsPan(input: PointerDownInput, spaceHeld: boolean): boolean {
  if (input.kind === 'mouse') {
    return input.button === MIDDLE_BUTTON || (input.button === LEFT_BUTTON && spaceHeld);
  }
  return input.onBackground;
}

function midpoint(a: Point, b: Point): Point {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/** Щипок: сдвиг на смещение середины и зум на отношение расстояний между пальцами. */
function pinch(camera: Camera, before: [Point, Point], after: [Point, Point]): Camera {
  const midBefore = midpoint(...before);
  const midAfter = midpoint(...after);
  const distBefore = distance(...before);
  const moved = panBy(camera, midAfter.x - midBefore.x, midAfter.y - midBefore.y);
  if (distBefore === 0) return moved;
  return zoomAt(moved, midAfter, distance(...after) / distBefore);
}

/** Колесо: Ctrl — зум к курсору, Shift — горизонтальная прокрутка, иначе — прокрутка. */
function wheelCamera(camera: Camera, input: WheelInput): Camera {
  const dx = normalizeDelta(input.deltaX, input.deltaMode);
  const dy = normalizeDelta(input.deltaY, input.deltaMode);
  if (input.ctrlKey) return zoomAt(camera, input.point, Math.exp(-dy * WHEEL_ZOOM_SPEED));
  if (input.shiftKey && dx === 0) return panBy(camera, -dy, 0);
  return panBy(camera, -dx, -dy);
}

export function createPanZoomController(
  initial: Camera,
  onChange: (camera: Camera) => void,
): PanZoomController {
  let camera = initial;
  let spaceHeld = false;
  const pointers = new Map<number, Point>();

  const update = (next: Camera): void => {
    camera = next;
    onChange(camera);
  };

  const movePointer = (id: number, point: Point): void => {
    const previous = pointers.get(id);
    if (previous === undefined) return;
    const others = [...pointers].filter(([otherId]) => otherId !== id);
    const partner = others[0];
    pointers.set(id, point);
    if (partner === undefined) {
      update(panBy(camera, point.x - previous.x, point.y - previous.y));
      return;
    }
    const [, partnerPoint] = partner;
    update(pinch(camera, [previous, partnerPoint], [point, partnerPoint]));
  };

  return {
    pointerDown: (input) => {
      const joinsPinch = input.kind !== 'mouse' && pointers.size === 1;
      if (pointers.size >= 2 || (!joinsPinch && !startsPan(input, spaceHeld))) return false;
      pointers.set(input.id, input.point);
      return true;
    },
    pointerMove: movePointer,
    pointerUp: (id) => {
      pointers.delete(id);
    },
    wheel: (input) => {
      update(wheelCamera(camera, input));
    },
    setSpaceHeld: (held) => {
      spaceHeld = held;
    },
    getCamera: () => camera,
    setCamera: update,
  };
}
