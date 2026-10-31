import { describe, expect, it } from 'vitest';
import {
  containsRect,
  detailForZoom,
  expandRect,
  intersects,
  nextDetailLevel,
  nextRenderRect,
  visibleWorldRect,
} from './visibility';

describe('visibleWorldRect', () => {
  it('учитывает сдвиг и масштаб камеры', () => {
    const rect = visibleWorldRect(
      { offsetX: -200, offsetY: 100, zoom: 2 },
      { width: 800, height: 600 },
    );
    expect(rect).toEqual({ x: 100, y: -50, width: 400, height: 300 });
  });
});

describe('прямоугольники', () => {
  const a = { x: 0, y: 0, width: 100, height: 100 };

  it('пересечение', () => {
    expect(intersects(a, { x: 50, y: 50, width: 100, height: 100 })).toBe(true);
    expect(intersects(a, { x: 100, y: 0, width: 10, height: 10 })).toBe(false);
  });

  it('вложенность', () => {
    expect(containsRect(a, { x: 10, y: 10, width: 20, height: 20 })).toBe(true);
    expect(containsRect(a, { x: 90, y: 10, width: 20, height: 20 })).toBe(false);
  });

  it('расширение на долю размера', () => {
    expect(expandRect(a, 0.5)).toEqual({ x: -50, y: -50, width: 200, height: 200 });
  });
});

describe('nextRenderRect', () => {
  const visible = { x: 0, y: 0, width: 100, height: 100 };

  it('первый раз берёт видимую область с запасом', () => {
    expect(nextRenderRect(null, visible, 0.5)).toEqual(expandRect(visible, 0.5));
  });

  it('при небольшом пане оставляет прежнюю область (без перерисовки)', () => {
    const previous = nextRenderRect(null, visible, 0.5);
    const moved = { ...visible, x: 30, y: -20 };
    expect(nextRenderRect(previous, moved, 0.5)).toBe(previous);
  });

  it('пересчитывает, когда видимая часть вышла за запас', () => {
    const previous = nextRenderRect(null, visible, 0.5);
    const far = { ...visible, x: 500 };
    expect(nextRenderRect(previous, far, 0.5)).toEqual(expandRect(far, 0.5));
  });

  it('пересчитывает при сильном приближении, чтобы не рендерить лишнее', () => {
    const previous = nextRenderRect(null, visible, 0.5);
    const zoomedIn = { x: 40, y: 40, width: 20, height: 20 };
    expect(nextRenderRect(previous, zoomedIn, 0.5)).toEqual(expandRect(zoomedIn, 0.5));
  });
});

describe('уровень детализации', () => {
  it('мелкий масштаб — обзорный вид', () => {
    expect(detailForZoom(0.2)).toBe('compact');
    expect(detailForZoom(1)).toBe('full');
  });

  it('у порога вид не переключается туда-обратно', () => {
    expect(nextDetailLevel('full', 0.49)).toBe('full');
    expect(nextDetailLevel('compact', 0.51)).toBe('compact');
  });

  it('за пределами зазора переключается', () => {
    expect(nextDetailLevel('full', 0.45)).toBe('compact');
    expect(nextDetailLevel('compact', 0.55)).toBe('full');
  });
});
