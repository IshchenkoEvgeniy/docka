import { describe, expect, it } from 'vitest';
import { INITIAL_CAMERA, screenToWorld, type Camera } from './camera';
import { createPanZoomController, type PointerDownInput } from './panZoomController';

function setup(initial: Camera = INITIAL_CAMERA) {
  const changes: Camera[] = [];
  const controller = createPanZoomController(initial, (camera) => changes.push(camera));
  return { controller, changes };
}

const mouse = (button: number, x = 0, y = 0): PointerDownInput => ({
  id: 1,
  kind: 'mouse',
  button,
  point: { x, y },
  onBackground: true,
});

const touch = (id: number, x: number, y: number, onBackground = true): PointerDownInput => ({
  id,
  kind: 'touch',
  button: 0,
  point: { x, y },
  onBackground,
});

const wheel = { deltaX: 0, deltaY: 0, deltaMode: 0, ctrlKey: false, shiftKey: false };

describe('пан мышью', () => {
  it('средняя кнопка двигает холст', () => {
    const { controller } = setup();
    expect(controller.pointerDown(mouse(1, 10, 10))).toBe(true);
    controller.pointerMove(1, { x: 40, y: 30 });
    expect(controller.getCamera()).toEqual({ offsetX: 30, offsetY: 20, zoom: 1 });
  });

  it('левая кнопка без пробела не двигает холст (она для выделения)', () => {
    const { controller, changes } = setup();
    expect(controller.pointerDown(mouse(0))).toBe(false);
    controller.pointerMove(1, { x: 50, y: 50 });
    expect(changes).toHaveLength(0);
  });

  it('левая кнопка с зажатым пробелом двигает холст', () => {
    const { controller } = setup();
    controller.setSpaceHeld(true);
    expect(controller.pointerDown(mouse(0))).toBe(true);
    controller.pointerMove(1, { x: -5, y: 5 });
    expect(controller.getCamera()).toEqual({ offsetX: -5, offsetY: 5, zoom: 1 });
  });

  it('после отпускания движение указателя ничего не меняет', () => {
    const { controller, changes } = setup();
    controller.pointerDown(mouse(1));
    controller.pointerUp(1);
    controller.pointerMove(1, { x: 100, y: 100 });
    expect(changes).toHaveLength(0);
  });
});

describe('колесо и тачпад', () => {
  it('Ctrl + колесо приближает к курсору, точка под курсором не уезжает', () => {
    const { controller } = setup();
    const point = { x: 200, y: 150 };
    const before = screenToWorld(controller.getCamera(), point);
    controller.wheel({ ...wheel, point, deltaY: -100, ctrlKey: true });
    const camera = controller.getCamera();
    expect(camera.zoom).toBeGreaterThan(1);
    expect(screenToWorld(camera, point).x).toBeCloseTo(before.x);
    expect(screenToWorld(camera, point).y).toBeCloseTo(before.y);
  });

  it('колесо без Ctrl прокручивает', () => {
    const { controller } = setup();
    controller.wheel({ ...wheel, point: { x: 0, y: 0 }, deltaX: 10, deltaY: 30 });
    expect(controller.getCamera()).toEqual({ offsetX: -10, offsetY: -30, zoom: 1 });
  });

  it('Shift + колесо прокручивает по горизонтали', () => {
    const { controller } = setup();
    controller.wheel({ ...wheel, point: { x: 0, y: 0 }, deltaY: 40, shiftKey: true });
    expect(controller.getCamera()).toEqual({ offsetX: -40, offsetY: 0, zoom: 1 });
  });

  it('прокрутка строками переводится в пиксели', () => {
    const { controller } = setup();
    controller.wheel({ ...wheel, point: { x: 0, y: 0 }, deltaY: 3, deltaMode: 1 });
    expect(controller.getCamera().offsetY).toBe(-48);
  });
});

describe('пальцы', () => {
  it('один палец по пустому месту двигает холст', () => {
    const { controller } = setup();
    expect(controller.pointerDown(touch(1, 0, 0))).toBe(true);
    controller.pointerMove(1, { x: 15, y: 25 });
    expect(controller.getCamera()).toEqual({ offsetX: 15, offsetY: 25, zoom: 1 });
  });

  it('один палец по элементу не двигает холст', () => {
    const { controller } = setup();
    expect(controller.pointerDown(touch(1, 0, 0, false))).toBe(false);
  });

  it('щипок приближает к середине между пальцами', () => {
    const { controller } = setup();
    controller.pointerDown(touch(1, 100, 100));
    controller.pointerDown(touch(2, 200, 100));
    const middle = { x: 150, y: 100 };
    const before = screenToWorld(controller.getCamera(), middle);
    controller.pointerMove(1, { x: 50, y: 100 });
    controller.pointerMove(2, { x: 250, y: 100 });
    const camera = controller.getCamera();
    expect(camera.zoom).toBeCloseTo(2);
    expect(screenToWorld(camera, middle).x).toBeCloseTo(before.x);
    expect(screenToWorld(camera, middle).y).toBeCloseTo(before.y);
  });

  it('второй палец подключается к жесту, даже если коснулся элемента', () => {
    const { controller } = setup();
    controller.pointerDown(touch(1, 0, 0));
    expect(controller.pointerDown(touch(2, 50, 0, false))).toBe(true);
  });

  it('третий палец игнорируется', () => {
    const { controller } = setup();
    controller.pointerDown(touch(1, 0, 0));
    controller.pointerDown(touch(2, 50, 0));
    expect(controller.pointerDown(touch(3, 90, 0))).toBe(false);
  });

  it('после подъёма одного пальца оставшийся продолжает пан', () => {
    const { controller } = setup();
    controller.pointerDown(touch(1, 0, 0));
    controller.pointerDown(touch(2, 100, 0));
    controller.pointerUp(2);
    controller.pointerMove(1, { x: 10, y: 0 });
    expect(controller.getCamera()).toEqual({ offsetX: 10, offsetY: 0, zoom: 1 });
  });
});
