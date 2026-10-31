import { describe, expect, it } from 'vitest';
import {
  INITIAL_CAMERA,
  MAX_ZOOM,
  MIN_ZOOM,
  cameraTransform,
  fitBounds,
  zoomToLevel,
  panBy,
  screenToWorld,
  worldToScreen,
  zoomAt,
  type Camera,
} from './camera';

const camera: Camera = { offsetX: 100, offsetY: -50, zoom: 2 };

describe('camera', () => {
  it('переводит мир в экран и обратно без потерь', () => {
    const world = { x: 12.5, y: -7 };
    const back = screenToWorld(camera, worldToScreen(camera, world));
    expect(back.x).toBeCloseTo(world.x);
    expect(back.y).toBeCloseTo(world.y);
  });

  it('сдвигает содержимое на экранные пиксели', () => {
    expect(panBy(camera, 10, -20)).toEqual({ offsetX: 110, offsetY: -70, zoom: 2 });
  });

  it('зум оставляет точку под курсором на месте', () => {
    const anchor = { x: 300, y: 200 };
    const before = screenToWorld(camera, anchor);
    const zoomed = zoomAt(camera, anchor, 1.5);
    const after = screenToWorld(zoomed, anchor);
    expect(zoomed.zoom).toBeCloseTo(3);
    expect(after.x).toBeCloseTo(before.x);
    expect(after.y).toBeCloseTo(before.y);
  });

  it('ограничивает масштаб пределами 10–400 %', () => {
    expect(zoomAt(INITIAL_CAMERA, { x: 0, y: 0 }, 100).zoom).toBe(MAX_ZOOM);
    expect(zoomAt(INITIAL_CAMERA, { x: 0, y: 0 }, 0.001).zoom).toBe(MIN_ZOOM);
  });

  it('у предела масштаба точка под курсором тоже не уезжает', () => {
    const atMax: Camera = { offsetX: 40, offsetY: 40, zoom: MAX_ZOOM };
    const anchor = { x: 200, y: 100 };
    expect(zoomAt(atMax, anchor, 2)).toEqual(atMax);
  });

  it('строит CSS transform', () => {
    expect(cameraTransform(camera)).toBe('translate(100px, -50px) scale(2)');
  });
});

describe('показать всё и 100 %', () => {
  const view = { width: 1000, height: 600 };

  it('доска целиком в окне и по центру', () => {
    const bounds = { x: 1000, y: 2000, width: 4000, height: 2000 };
    const camera = fitBounds(bounds, view, 50);
    expect(camera.zoom).toBeCloseTo(0.225);
    const center = screenToWorld(camera, { x: 500, y: 300 });
    expect(center.x).toBeCloseTo(3000);
    expect(center.y).toBeCloseTo(3000);
  });

  it('маленькую доску не увеличивает больше 100 %', () => {
    expect(fitBounds({ x: 0, y: 0, width: 10, height: 10 }, view).zoom).toBe(1);
  });

  it('100 % оставляет центр окна на месте', () => {
    const start = { offsetX: 120, offsetY: -40, zoom: 0.37 };
    const before = screenToWorld(start, { x: 500, y: 300 });
    const at100 = zoomToLevel(start, view, 1);
    expect(at100.zoom).toBe(1);
    expect(screenToWorld(at100, { x: 500, y: 300 }).x).toBeCloseTo(before.x);
  });
});
