import type { Point, Rect, Size } from './geometry';
import { snapToGrid } from './snapping';

export const RESIZE_HANDLES = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'] as const;
export type ResizeHandle = (typeof RESIZE_HANDLES)[number];
/** Текст меняет ширину и растёт по содержимому; изображения сохраняют пропорции. */
export type ResizeMode = 'none' | 'width' | 'both' | 'aspect';
export interface ResizeModifiers {
  readonly keepAspect?: boolean;
  readonly fromCenter?: boolean;
}
export interface ResizeOptions extends ResizeModifiers {
  readonly mode: ResizeMode;
  readonly minSize: Size;
  readonly grid?: number | null;
}

export function resizeHandles(mode: ResizeMode): readonly ResizeHandle[] {
  return mode === 'none' ? [] : mode === 'width' ? ['w', 'e'] : RESIZE_HANDLES;
}

function axisDelta(
  start: number,
  size: number,
  direction: number,
  delta: number,
  grid?: number | null,
): number {
  if (direction === 0) return 0;
  const edge = start + (direction > 0 ? size : 0);
  return grid === undefined || grid === null ? delta : snapToGrid(edge + delta, grid) - edge;
}

/** Противоположный край фиксирован; при Alt фиксирован центр. Не создаёт перевёрнутых прямоугольников. */
export function resizeRect(
  rect: Rect,
  handle: ResizeHandle,
  delta: Point,
  options: ResizeOptions,
): Rect {
  if (!resizeHandles(options.mode).includes(handle)) return rect;
  const horizontal = handle.includes('w') ? -1 : handle.includes('e') ? 1 : 0;
  const vertical = handle.includes('n') ? -1 : handle.includes('s') ? 1 : 0;
  const multiplier = options.fromCenter === true ? 2 : 1;
  let width =
    rect.width +
    axisDelta(rect.x, rect.width, horizontal, delta.x, options.grid) * horizontal * multiplier;
  let height =
    rect.height +
    axisDelta(rect.y, rect.height, vertical, delta.y, options.grid) * vertical * multiplier;
  if (options.mode !== 'width' && (options.mode === 'aspect' || options.keepAspect === true)) {
    const sx = width / rect.width,
      sy = height / rect.height;
    const scale =
      horizontal === 0 ? sy : vertical === 0 ? sx : Math.abs(sx - 1) >= Math.abs(sy - 1) ? sx : sy;
    const limited = Math.max(
      options.minSize.width / rect.width,
      options.minSize.height / rect.height,
      scale,
    );
    width = rect.width * limited;
    height = rect.height * limited;
  }
  width = Math.round(Math.max(options.minSize.width, width));
  height =
    options.mode === 'width' ? rect.height : Math.round(Math.max(options.minSize.height, height));
  const centered = options.fromCenter === true;
  return {
    x: Math.round(
      rect.x + (rect.width - width) * (centered || horizontal === 0 ? 0.5 : horizontal < 0 ? 1 : 0),
    ),
    y: Math.round(
      rect.y + (rect.height - height) * (centered || vertical === 0 ? 0.5 : vertical < 0 ? 1 : 0),
    ),
    width,
    height,
  };
}
