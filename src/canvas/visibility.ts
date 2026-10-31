import { screenToWorld, type Camera } from './camera';
import type { Rect, Size } from './geometry';

export type { Rect, Size } from './geometry';
export { intersects } from './geometry';

/** Какая часть мира видна во вьюпорте размера view. */
export function visibleWorldRect(camera: Camera, view: Size): Rect {
  const topLeft = screenToWorld(camera, { x: 0, y: 0 });
  return {
    x: topLeft.x,
    y: topLeft.y,
    width: view.width / camera.zoom,
    height: view.height / camera.zoom,
  };
}

/** Расширяет прямоугольник на долю его размера с каждой стороны. */
export function expandRect(rect: Rect, fraction: number): Rect {
  const dx = rect.width * fraction;
  const dy = rect.height * fraction;
  return {
    x: rect.x - dx,
    y: rect.y - dy,
    width: rect.width + 2 * dx,
    height: rect.height + 2 * dy,
  };
}

export function containsRect(outer: Rect, inner: Rect): boolean {
  return (
    inner.x >= outer.x &&
    inner.y >= outer.y &&
    inner.x + inner.width <= outer.x + outer.width &&
    inner.y + inner.height <= outer.y + outer.height
  );
}

/**
 * Область, в которой рендерятся элементы: видимая часть плюс запас.
 * Пересчитывается, только когда видимая часть вышла за прошлую область
 * или масштаб изменился вдвое, — поэтому во время пана React почти не перерисовывает.
 */
export function nextRenderRect(previous: Rect | null, visible: Rect, margin: number): Rect {
  if (previous !== null && containsRect(previous, visible)) {
    const tooLarge = previous.width > visible.width * (1 + 2 * margin) * 2;
    if (!tooLarge) return previous;
  }
  return expandRect(visible, margin);
}

export type DetailLevel = 'full' | 'compact';

/** Ниже этого масштаба текст не читается: элементы рисуются обзорной картинкой. */
export const COMPACT_ZOOM_THRESHOLD = 0.5;
/** Зазор вокруг порога, чтобы на границе вид не мигал при малейшем движении колеса. */
const HYSTERESIS = 0.03;

export function detailForZoom(zoom: number): DetailLevel {
  return zoom < COMPACT_ZOOM_THRESHOLD ? 'compact' : 'full';
}

/** Уровень детализации с учётом предыдущего: переключение только за пределами зазора. */
export function nextDetailLevel(previous: DetailLevel, zoom: number): DetailLevel {
  if (previous === 'full' && zoom < COMPACT_ZOOM_THRESHOLD - HYSTERESIS) return 'compact';
  if (previous === 'compact' && zoom > COMPACT_ZOOM_THRESHOLD + HYSTERESIS) return 'full';
  return previous;
}
