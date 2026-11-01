import { describe, expect, it } from 'vitest';
import { resizeRect, resizeHandles, type ResizeHandle } from './resize';

const rect = { x: 100, y: 80, width: 300, height: 200 };
const options = { mode: 'both' as const, minSize: { width: 80, height: 40 } };

describe('изменение размера за края и углы', () => {
  it.each<[ResizeHandle, number, number, number, number, number, number]>([
    ['nw', -60, -40, 40, 40, 360, 240],
    ['n', 0, -40, 100, 40, 300, 240],
    ['ne', 60, -40, 100, 40, 360, 240],
    ['e', 60, 0, 100, 80, 360, 200],
    ['se', 60, 40, 100, 80, 360, 240],
    ['s', 0, 40, 100, 80, 300, 240],
    ['sw', -60, 40, 40, 80, 360, 240],
    ['w', -60, 0, 40, 80, 360, 200],
  ])('%s: противоположный край остаётся на месте', (handle, x, y, left, top, width, height) => {
    expect(resizeRect(rect, handle, { x, y }, options)).toEqual({ x: left, y: top, width, height });
  });

  it('не переворачивает элемент за противоположным углом и ограничивает минимум', () => {
    expect(resizeRect(rect, 'nw', { x: 1000, y: 1000 }, options)).toEqual({
      x: 320,
      y: 240,
      width: 80,
      height: 40,
    });
  });

  it('Alt сохраняет центр, в том числе на минимальном размере', () => {
    const grown = resizeRect(rect, 'nw', { x: -30, y: -20 }, { ...options, fromCenter: true });
    expect(grown).toEqual({ x: 70, y: 60, width: 360, height: 240 });
    const small = resizeRect(rect, 'nw', { x: 1000, y: 1000 }, { ...options, fromCenter: true });
    expect(small.x + small.width / 2).toBe(250);
    expect(small.y + small.height / 2).toBe(180);
  });

  it('автовысота текста: две стороны, ширина меняется без ручной высоты', () => {
    expect(resizeHandles('width')).toEqual(['w', 'e']);
    expect(resizeRect(rect, 'w', { x: -60, y: 300 }, { ...options, mode: 'width' })).toEqual({
      x: 40,
      y: 80,
      width: 360,
      height: 200,
    });
    expect(resizeRect(rect, 'n', { x: 0, y: 100 }, { ...options, mode: 'width' })).toEqual(rect);
  });

  it.each<ResizeHandle>(['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'])(
    'картинка %s: пропорции и противоположная точка',
    (handle) => {
      const x = handle.includes('w') ? -60 : handle.includes('e') ? 60 : 0;
      const y = handle.includes('n') ? -40 : handle.includes('s') ? 40 : 0;
      const resized = resizeRect(rect, handle, { x, y }, { ...options, mode: 'aspect' });
      expect(resized.width).toBe(360);
      expect(resized.height).toBe(240);
      expect(
        resized.x + resized.width * (handle.includes('w') ? 1 : handle.includes('e') ? 0 : 0.5),
      ).toBe(rect.x + rect.width * (handle.includes('w') ? 1 : handle.includes('e') ? 0 : 0.5));
      expect(
        resized.y + resized.height * (handle.includes('n') ? 1 : handle.includes('s') ? 0 : 0.5),
      ).toBe(rect.y + rect.height * (handle.includes('n') ? 1 : handle.includes('s') ? 0 : 0.5));
    },
  );

  it('вертикальное движение угла картинки работает даже без изменения x', () => {
    expect(resizeRect(rect, 'se', { x: 0, y: 100 }, { ...options, mode: 'aspect' })).toEqual({
      x: 100,
      y: 80,
      width: 450,
      height: 300,
    });
  });

  it('Shift включает пропорции для свободного прямоугольника', () => {
    expect(resizeRect(rect, 'se', { x: 60, y: 0 }, { ...options, keepAspect: true })).toEqual({
      x: 100,
      y: 80,
      width: 360,
      height: 240,
    });
  });

  it('сетка привязывает движущийся левый и верхний края', () => {
    expect(
      resizeRect({ ...rect, x: 5 }, 'nw', { x: -14, y: -20 }, { ...options, grid: 24 }),
    ).toEqual({ x: 0, y: 72, width: 305, height: 208 });
  });
});
