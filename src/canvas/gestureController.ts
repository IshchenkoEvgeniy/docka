import { screenToWorld } from './camera';
import { rectFromCorners, type Point, type Rect } from './geometry';
import {
  createPanZoomController,
  type PanZoomController,
  type PointerKind,
  type WheelInput,
} from './panZoomController';
import type { Camera } from './camera';
import type { ResizeHandle, ResizeModifiers } from './resize';
export type { ResizeHandle } from './resize';

/**
 * Жесты холста поверх пана и зума (ТЗ, раздел 4). Без DOM и без знания о данных:
 * на вход — нормализованные события, на выход — вызовы GestureHandlers.
 *
 * Мышь: левой по элементу — выделить и тащить; по пустому месту — рамка выделения;
 * за ручку — изменить размер; правой — контекстное меню (событие contextmenu, не здесь).
 * Палец: по элементу — выделить и тащить; долгое нажатие на элемент — меню;
 * по пустому месту — пан, долгое нажатие — рамка (или меню, если палец не двигался);
 * второй палец в любой момент отменяет начатое и превращает жест в щипок.
 */

export type PointerTarget =
  | { readonly kind: 'background' }
  | { readonly kind: 'element'; readonly id: string }
  | { readonly kind: 'handle'; readonly id: string; readonly handle: ResizeHandle }
  /** Стрелка между элементами. */
  | { readonly kind: 'connection'; readonly id: string }
  /** Кружок у выделенного элемента: потянуть — провести стрелку. */
  | { readonly kind: 'connector'; readonly id: string };

export interface GesturePointerInput {
  readonly id: number;
  readonly kind: PointerKind;
  readonly button: number;
  /** Точка в координатах вьюпорта (CSS-пиксели). */
  readonly point: Point;
  readonly target: PointerTarget;
  /** Shift (или Ctrl/Cmd) — добавить к выделению. */
  readonly additive: boolean;
}

/** Смещения и прямоугольники — в мировых координатах. */
export interface GestureHandlers {
  readonly pressElement: (id: string, additive: boolean) => void;
  /** Отпускание без перетаскивания: двойной клик мышью или касание пальцем — повод начать правку. */
  readonly releaseElement: (id: string, kind: ReleaseKind) => void;
  readonly clickBackground: () => void;
  /** false — двигать нечего (например, всё закреплено). */
  readonly startMove: () => boolean;
  readonly updateMove: (delta: Point) => void;
  readonly endMove: (commit: boolean) => void;
  readonly startResize: (id: string, handle: ResizeHandle) => boolean;
  readonly updateResize: (delta: Point, modifiers?: ResizeModifiers) => void;
  readonly endResize: (commit: boolean) => void;
  readonly updateMarquee: (rect: Rect, additive: boolean) => void;
  readonly endMarquee: (commit: boolean) => void;
  /** Долгое нажатие пальцем; screen — точка во вьюпорте. */
  readonly openMenu: (target: PointerTarget, screen: Point) => void;
  readonly pressConnection: (id: string) => void;
  /** Начало стрелки от элемента; point — где сейчас указатель (мир). */
  readonly startConnect: (fromId: string) => void;
  readonly updateConnect: (point: Point) => void;
  readonly endConnect: (commit: boolean, point: Point) => void;
}

export type ReleaseKind = 'click' | 'doubleClick' | 'tap';

export type Scheduler = (callback: () => void, ms: number) => () => void;

export const LONG_PRESS_MS = 500;
const DRAG_THRESHOLD_PX: Readonly<Record<PointerKind, number>> = { mouse: 4, pen: 6, touch: 10 };
const LEFT_BUTTON = 0;
const DOUBLE_CLICK_MS = 400;
const DOUBLE_CLICK_PX = 6;

interface Tracked {
  readonly pointer: number;
  readonly pointerKind: PointerKind;
  readonly start: Point;
  /** Начальная точка в мире: если камера сдвинется во время жеста, смещение останется верным. */
  readonly startWorld: Point;
  last: Point;
  modifiers?: ResizeModifiers;
}

type Phase =
  | { readonly kind: 'idle' }
  | { readonly kind: 'pan' }
  | (Tracked & {
      readonly kind: 'press';
      readonly target: PointerTarget;
      readonly additive: boolean;
      /** Касание по пустому месту: пока это пан, а долгое нажатие сделает его рамкой. */
      readonly panning: boolean;
      cancelTimer: () => void;
    })
  | (Tracked & { readonly kind: 'move' | 'resize' | 'blocked' | 'connect' })
  | (Tracked & { readonly kind: 'marquee'; readonly additive: boolean; moved: boolean });

const IDLE: Phase = { kind: 'idle' };

function beyondThreshold(tracked: Tracked, point: Point): boolean {
  const distance = Math.hypot(point.x - tracked.start.x, point.y - tracked.start.y);
  return distance >= DRAG_THRESHOLD_PX[tracked.pointerKind];
}
const noop = (): void => undefined;

const defaultScheduler: Scheduler = (callback, ms) => {
  const timer = setTimeout(callback, ms);
  return () => {
    clearTimeout(timer);
  };
};

export class GestureController {
  readonly panZoom: PanZoomController;
  private phase: Phase = IDLE;
  private readonly panPointers = new Set<number>();
  private lastClick: { readonly id: string; readonly at: number; readonly point: Point } | null =
    null;

  constructor(
    initial: Camera,
    onCameraChange: (camera: Camera) => void,
    private readonly getHandlers: () => GestureHandlers | null,
    private readonly schedule: Scheduler = defaultScheduler,
    private readonly now: () => number = Date.now,
  ) {
    this.panZoom = createPanZoomController(initial, onCameraChange);
  }

  /** true — жест захвачен, указатель нужно удерживать за холстом. */
  readonly pointerDown = (input: GesturePointerInput): boolean => {
    if (this.phase.kind !== 'idle') return this.secondPointer(input);
    if (input.kind === 'mouse' && this.startPan(input, false)) return true;
    if (input.kind === 'mouse' && input.button !== LEFT_BUTTON) return false;
    const handlers = this.getHandlers();
    if (handlers === null) return this.startPan(input, true);
    const { target } = input;
    if (target.kind === 'connector') {
      handlers.startConnect(target.id);
      this.phase = { ...this.track(input), kind: 'connect' };
      return true;
    }
    if (target.kind === 'connection') handlers.pressConnection(target.id);
    if (target.kind === 'handle') {
      const started = handlers.startResize(target.id, target.handle);
      this.phase = { ...this.track(input), kind: started ? 'resize' : 'blocked' };
      return true;
    }
    if (target.kind === 'element') handlers.pressElement(target.id, input.additive);
    const panning = target.kind === 'background' && input.kind !== 'mouse';
    if (panning) this.startPan(input, true);
    const longPress = input.kind !== 'mouse';
    this.phase = {
      ...this.track(input),
      kind: 'press',
      target,
      additive: input.additive,
      panning,
      cancelTimer: longPress ? this.schedule(this.longPress, LONG_PRESS_MS) : noop,
    };
    return true;
  };

  readonly pointerMove = (id: number, point: Point, modifiers?: ResizeModifiers): void => {
    const phase = this.phase;
    if (phase.kind === 'pan' || phase.kind === 'idle') {
      this.panZoom.pointerMove(id, point);
      return;
    }
    if (phase.pointer !== id) return;
    phase.last = point;
    if (modifiers !== undefined) phase.modifiers = modifiers;
    if (phase.kind === 'press') {
      this.movePress(phase, point);
      return;
    }
    if (phase.kind === 'marquee' && beyondThreshold(phase, point)) phase.moved = true;
    this.continueGesture();
  };

  readonly pointerUp = (id: number): void => {
    const phase = this.phase;
    if (phase.kind === 'pan' || phase.kind === 'idle') {
      this.panZoom.pointerUp(id);
      this.panPointers.delete(id);
      if (this.panPointers.size === 0) this.phase = IDLE;
      return;
    }
    if (phase.pointer !== id) return;
    this.finish(true);
  };

  readonly wheel = (input: WheelInput): void => {
    this.panZoom.wheel(input);
    if (this.phase.kind !== 'idle' && this.phase.kind !== 'pan') this.continueGesture();
  };

  /** Отменить начатое (Esc): перетаскивание и рамка не применяются. */
  readonly cancel = (): boolean => {
    if (this.phase.kind === 'idle' || this.phase.kind === 'pan') return false;
    this.finish(false);
    return true;
  };

  readonly isBusy = (): boolean => this.phase.kind !== 'idle';

  private track(input: GesturePointerInput): Tracked {
    const camera = this.panZoom.getCamera();
    return {
      pointer: input.id,
      pointerKind: input.kind,
      start: input.point,
      startWorld: screenToWorld(camera, input.point),
      last: input.point,
    };
  }

  private startPan(input: GesturePointerInput, onBackground: boolean): boolean {
    const started = this.panZoom.pointerDown({ ...input, onBackground });
    if (!started) return false;
    this.panPointers.add(input.id);
    if (this.phase.kind === 'idle') this.phase = { kind: 'pan' };
    return true;
  }

  /** Второй палец: начатое отменяется, оба пальца уходят в щипок. */
  private secondPointer(input: GesturePointerInput): boolean {
    const phase = this.phase;
    if (input.kind === 'mouse' || phase.kind === 'idle') return false;
    if (phase.kind === 'pan') return this.startPan(input, true);
    if (phase.kind === 'press' && phase.panning) {
      phase.cancelTimer();
      this.phase = { kind: 'pan' };
      return this.startPan(input, true);
    }
    const first: GesturePointerInput = {
      id: phase.pointer,
      kind: phase.pointerKind,
      button: LEFT_BUTTON,
      point: phase.last,
      target: { kind: 'background' },
      additive: false,
    };
    this.finish(false);
    this.startPan(first, true);
    return this.startPan(input, true);
  }

  private readonly longPress = (): void => {
    const phase = this.phase;
    if (phase.kind !== 'press') return;
    if (phase.target.kind === 'background') {
      if (phase.panning) {
        this.panZoom.pointerUp(phase.pointer);
        this.panPointers.delete(phase.pointer);
      }
      this.phase = { ...phase, kind: 'marquee', moved: false };
      this.continueGesture();
      return;
    }
    this.phase = { ...phase, kind: 'blocked' };
    this.getHandlers()?.openMenu(phase.target, phase.last);
  };

  private movePress(phase: Extract<Phase, { kind: 'press' }>, point: Point): void {
    if (phase.panning) this.panZoom.pointerMove(phase.pointer, point);
    if (!beyondThreshold(phase, point)) return;
    phase.cancelTimer();
    if (phase.panning) {
      this.phase = { kind: 'pan' };
      return;
    }
    const handlers = this.getHandlers();
    if (phase.target.kind === 'background') {
      this.phase = { ...phase, kind: 'marquee', moved: true };
    } else if (phase.target.kind === 'connection') {
      this.phase = { ...phase, kind: 'blocked' };
    } else {
      const started = handlers?.startMove() ?? false;
      this.phase = { ...phase, kind: started ? 'move' : 'blocked' };
    }
    this.continueGesture();
  }

  private continueGesture(): void {
    const phase = this.phase;
    const handlers = this.getHandlers();
    if (handlers === null || phase.kind === 'idle' || phase.kind === 'pan') return;
    const current = screenToWorld(this.panZoom.getCamera(), phase.last);
    const delta = { x: current.x - phase.startWorld.x, y: current.y - phase.startWorld.y };
    if (phase.kind === 'move') handlers.updateMove(delta);
    else if (phase.kind === 'resize') handlers.updateResize(delta, phase.modifiers);
    else if (phase.kind === 'connect') handlers.updateConnect(current);
    else if (phase.kind === 'marquee')
      handlers.updateMarquee(rectFromCorners(phase.startWorld, current), phase.additive);
  }

  /** Мышью: второй клик по тому же элементу рядом и быстро — двойной. Пальцем — касание. */
  private releaseKind(tracked: Tracked, id: string): ReleaseKind {
    if (tracked.pointerKind !== 'mouse') return 'tap';
    const at = this.now();
    const previous = this.lastClick;
    const double =
      previous !== null &&
      previous.id === id &&
      at - previous.at < DOUBLE_CLICK_MS &&
      Math.hypot(tracked.last.x - previous.point.x, tracked.last.y - previous.point.y) <
        DOUBLE_CLICK_PX;
    this.lastClick = double ? null : { id, at, point: tracked.last };
    return double ? 'doubleClick' : 'click';
  }

  private finish(commit: boolean): void {
    const phase = this.phase;
    this.phase = IDLE;
    const handlers = this.getHandlers();
    if (handlers === null || phase.kind === 'idle' || phase.kind === 'pan') return;
    if (phase.kind === 'press') {
      phase.cancelTimer();
      if (phase.panning) this.panZoom.pointerUp(phase.pointer);
      this.panPointers.delete(phase.pointer);
      if (!commit) return;
      if (phase.target.kind === 'element')
        handlers.releaseElement(phase.target.id, this.releaseKind(phase, phase.target.id));
      else if (phase.target.kind === 'background') handlers.clickBackground();
    } else if (phase.kind === 'move') handlers.endMove(commit);
    else if (phase.kind === 'resize') handlers.endResize(commit);
    else if (phase.kind === 'connect')
      handlers.endConnect(commit, screenToWorld(this.panZoom.getCamera(), phase.last));
    else if (phase.kind === 'marquee') {
      handlers.endMarquee(commit);
      if (commit && !phase.moved) handlers.openMenu({ kind: 'background' }, phase.last);
    }
  }
}
