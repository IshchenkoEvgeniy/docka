import type { Camera } from './camera';
import { intersects, visibleWorldRect, type Rect, type Size } from './visibility';

/**
 * Обзорный режим: на мелком масштабе элементы рисуются одной картинкой на <canvas>,
 * а не тысячей DOM-блоков (ADR 0001). Здесь — только отрисовка, без DOM.
 */

export interface OverviewItem {
  readonly rect: Rect;
  /** Цвет заливки: CSS-цвет или имя токена вида '--color-card-yellow'. */
  readonly fill: string;
}

export interface OverviewStyle {
  /** Цвет обводки (уже вычисленный CSS-цвет). */
  readonly stroke: string;
  /** Радиус скругления в мировых единицах. */
  readonly radius: number;
}

/** Минимальный набор методов 2D-контекста, который нужен для отрисовки (удобно подменять в тестах). */
export type OverviewContext = Pick<
  CanvasRenderingContext2D,
  'setTransform' | 'clearRect' | 'beginPath' | 'roundRect' | 'fill' | 'stroke'
> & {
  fillStyle: CanvasRenderingContext2D['fillStyle'];
  strokeStyle: CanvasRenderingContext2D['strokeStyle'];
  lineWidth: number;
};

/** Видимые элементы, сгруппированные по цвету: один fill() на цвет вместо одного на элемент. */
export function groupVisibleByFill(
  items: readonly OverviewItem[],
  visible: Rect,
): Map<string, Rect[]> {
  const groups = new Map<string, Rect[]>();
  for (const item of items) {
    if (!intersects(item.rect, visible)) continue;
    const group = groups.get(item.fill);
    if (group === undefined) groups.set(item.fill, [item.rect]);
    else group.push(item.rect);
  }
  return groups;
}

export function drawOverview(
  context: OverviewContext,
  items: readonly OverviewItem[],
  camera: Camera,
  view: Size,
  pixelRatio: number,
  style: OverviewStyle,
  resolveColor: (fill: string) => string,
): void {
  context.setTransform(1, 0, 0, 1, 0, 0);
  context.clearRect(0, 0, view.width * pixelRatio, view.height * pixelRatio);
  const scale = camera.zoom * pixelRatio;
  context.setTransform(
    scale,
    0,
    0,
    scale,
    camera.offsetX * pixelRatio,
    camera.offsetY * pixelRatio,
  );

  const groups = groupVisibleByFill(items, visibleWorldRect(camera, view));
  context.strokeStyle = style.stroke;
  context.lineWidth = 1 / camera.zoom;
  for (const [fill, rects] of groups) {
    context.beginPath();
    for (const rect of rects)
      context.roundRect(rect.x, rect.y, rect.width, rect.height, style.radius);
    context.fillStyle = resolveColor(fill);
    context.fill();
    context.stroke();
  }
}
