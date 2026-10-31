import { describe, expect, it } from 'vitest';
import {
  GestureController,
  type GestureHandlers,
  type GesturePointerInput,
  type PointerTarget,
} from './gestureController';
import type { PointerKind } from './panZoomController';

function setup(options: { movable?: boolean } = {}) {
  const calls: string[] = [];
  const deltas: { x: number; y: number }[] = [];
  const timers: (() => void)[] = [];
  const handlers: GestureHandlers = {
    pressElement: (id, additive) => calls.push(`press ${id}${additive ? ' +' : ''}`),
    releaseElement: (id, kind) => calls.push(kind === 'click' ? `release ${id}` : `${kind} ${id}`),
    clickBackground: () => calls.push('clickBackground'),
    startMove: () => {
      calls.push('startMove');
      return options.movable ?? true;
    },
    updateMove: (delta) => deltas.push(delta),
    endMove: (commit) => calls.push(`endMove ${String(commit)}`),
    startResize: (id, handle) => {
      calls.push(`startResize ${id} ${handle}`);
      return true;
    },
    updateResize: (delta) => deltas.push(delta),
    endResize: (commit) => calls.push(`endResize ${String(commit)}`),
    updateMarquee: (rect) => calls.push(`marquee ${String(rect.width)}x${String(rect.height)}`),
    endMarquee: (commit) => calls.push(`endMarquee ${String(commit)}`),
    openMenu: (target) => calls.push(`menu ${target.kind}`),
    pressConnection: (id) => calls.push(`connection ${id}`),
    startConnect: (id) => calls.push(`connect from ${id}`),
    updateConnect: (point) => deltas.push(point),
    endConnect: (commit, point) =>
      calls.push(`connect end ${String(commit)} ${String(point.x)},${String(point.y)}`),
  };
  const schedule = (callback: () => void) => {
    timers.push(callback);
    return () => {
      const index = timers.indexOf(callback);
      if (index >= 0) timers.splice(index, 1);
    };
  };
  const controller = new GestureController(
    { offsetX: 0, offsetY: 0, zoom: 2 },
    () => undefined,
    () => handlers,
    schedule,
  );
  const fireTimers = () => {
    timers.splice(0).forEach((timer) => {
      timer();
    });
  };
  return { controller, calls, deltas, fireTimers, handlers };
}

const handlersOf = (setupResult: ReturnType<typeof setup>) => setupResult.handlers;

const ELEMENT: PointerTarget = { kind: 'element', id: 'a' };
const BACKGROUND: PointerTarget = { kind: 'background' };

function down(
  target: PointerTarget,
  x = 0,
  y = 0,
  kind: PointerKind = 'mouse',
  id = 1,
): GesturePointerInput {
  return { id, kind, button: 0, point: { x, y }, target, additive: false };
}

describe('жесты мышью', () => {
  it('клик по элементу выделяет его, без перетаскивания', () => {
    const { controller, calls } = setup();
    controller.pointerDown(down(ELEMENT));
    controller.pointerMove(1, { x: 2, y: 1 });
    controller.pointerUp(1);
    expect(calls).toEqual(['press a', 'release a']);
  });

  it('двойной клик — быстро и на месте; медленный — два обычных', () => {
    let now = 0;
    const handlers = setup();
    const controller = new GestureController(
      { offsetX: 0, offsetY: 0, zoom: 1 },
      () => undefined,
      () => handlersOf(handlers),
      () => () => undefined,
      () => now,
    );
    const click = () => {
      controller.pointerDown(down(ELEMENT));
      controller.pointerUp(1);
    };
    click();
    now = 200;
    click();
    now = 2000;
    click();
    expect(handlers.calls.filter((call) => !call.startsWith('press'))).toEqual([
      'release a',
      'doubleClick a',
      'release a',
    ]);
  });

  it('перетаскивание даёт смещение в мировых координатах и коммит в конце', () => {
    const { controller, calls, deltas } = setup();
    controller.pointerDown(down(ELEMENT, 10, 10));
    controller.pointerMove(1, { x: 30, y: 50 });
    controller.pointerUp(1);
    expect(calls).toEqual(['press a', 'startMove', 'endMove true']);
    expect(deltas.at(-1)).toEqual({ x: 10, y: 20 }); // зум 2: 20 px экрана = 10 мира
  });

  it('Esc отменяет перетаскивание', () => {
    const { controller, calls } = setup();
    controller.pointerDown(down(ELEMENT));
    controller.pointerMove(1, { x: 40, y: 0 });
    expect(controller.cancel()).toBe(true);
    controller.pointerUp(1);
    expect(calls).toEqual(['press a', 'startMove', 'endMove false']);
  });

  it('закреплённое не двигается', () => {
    const { controller, calls, deltas } = setup({ movable: false });
    controller.pointerDown(down(ELEMENT));
    controller.pointerMove(1, { x: 40, y: 0 });
    controller.pointerUp(1);
    expect(calls).toEqual(['press a', 'startMove']);
    expect(deltas).toEqual([]);
  });

  it('по пустому месту — рамка, а простой клик снимает выделение', () => {
    const { controller, calls } = setup();
    controller.pointerDown(down(BACKGROUND, 0, 0));
    controller.pointerMove(1, { x: 20, y: 10 });
    controller.pointerUp(1);
    controller.pointerDown(down(BACKGROUND));
    controller.pointerUp(1);
    expect(calls).toEqual(['marquee 10x5', 'endMarquee true', 'clickBackground']);
  });

  it('ручка меняет размер сразу, без порога', () => {
    const { controller, calls, deltas } = setup();
    controller.pointerDown(down({ kind: 'handle', id: 'a', handle: 'se' }));
    controller.pointerMove(1, { x: 2, y: 2 });
    controller.pointerUp(1);
    expect(calls).toEqual(['startResize a se', 'endResize true']);
    expect(deltas).toEqual([{ x: 1, y: 1 }]);
  });

  it('стрелка тянется от кружка у элемента; щелчок по стрелке выделяет её', () => {
    const { controller, calls } = setup();
    controller.pointerDown(down({ kind: 'connector', id: 'a' }, 0, 0));
    controller.pointerMove(1, { x: 100, y: 40 });
    controller.pointerUp(1);
    controller.pointerDown(down({ kind: 'connection', id: 'c' }));
    controller.pointerMove(1, { x: 50, y: 0 });
    controller.pointerUp(1);
    expect(calls).toEqual(['connect from a', 'connect end true 50,20', 'connection c']);
  });

  it('средняя кнопка — пан, элементы не трогаются', () => {
    const { controller, calls } = setup();
    expect(controller.pointerDown({ ...down(ELEMENT), button: 1 })).toBe(true);
    controller.pointerMove(1, { x: 50, y: 0 });
    controller.pointerUp(1);
    expect(calls).toEqual([]);
    expect(controller.panZoom.getCamera().offsetX).toBe(50);
  });
});

describe('жесты пальцем', () => {
  it('по пустому месту — пан, касание без движения снимает выделение', () => {
    const { controller, calls } = setup();
    controller.pointerDown(down(BACKGROUND, 0, 0, 'touch'));
    controller.pointerMove(1, { x: 30, y: 0 });
    controller.pointerUp(1);
    expect(controller.panZoom.getCamera().offsetX).toBe(30);
    controller.pointerDown(down(BACKGROUND, 0, 0, 'touch'));
    controller.pointerUp(1);
    expect(calls).toEqual(['clickBackground']);
  });

  it('долгое нажатие на пустом месте — рамка, без движения — меню', () => {
    const { controller, calls, fireTimers } = setup();
    controller.pointerDown(down(BACKGROUND, 0, 0, 'touch'));
    fireTimers();
    controller.pointerMove(1, { x: 40, y: 20 });
    controller.pointerUp(1);
    controller.pointerDown(down(BACKGROUND, 0, 0, 'touch'));
    fireTimers();
    controller.pointerUp(1);
    expect(calls).toEqual([
      'marquee 0x0',
      'marquee 20x10',
      'endMarquee true',
      'marquee 0x0',
      'endMarquee true',
      'menu background',
    ]);
  });

  it('долгое нажатие на элементе открывает меню', () => {
    const { controller, calls, fireTimers } = setup();
    controller.pointerDown(down(ELEMENT, 0, 0, 'touch'));
    fireTimers();
    controller.pointerMove(1, { x: 40, y: 0 });
    controller.pointerUp(1);
    expect(calls).toEqual(['press a', 'menu element']);
  });

  it('касание элемента без движения — tap', () => {
    const { controller, calls } = setup();
    controller.pointerDown(down(ELEMENT, 0, 0, 'touch'));
    controller.pointerUp(1);
    expect(calls).toEqual(['press a', 'tap a']);
  });

  it('второй палец отменяет перетаскивание и включает щипок', () => {
    const { controller, calls } = setup();
    controller.pointerDown(down(ELEMENT, 0, 0, 'touch', 1));
    controller.pointerMove(1, { x: 40, y: 0 });
    expect(controller.pointerDown(down(ELEMENT, 100, 0, 'touch', 2))).toBe(true);
    controller.pointerMove(2, { x: 140, y: 0 });
    controller.pointerUp(1);
    controller.pointerUp(2);
    expect(calls).toEqual(['press a', 'startMove', 'endMove false']);
    expect(controller.panZoom.getCamera().zoom).toBeCloseTo(2 * (100 / 60));
    expect(controller.isBusy()).toBe(false);
  });
});
