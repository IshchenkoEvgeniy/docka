import type { Rect } from './geometry';
import type { Guide } from './interactionStore';

/**
 * Прилипание при перетаскивании: к краям и центрам соседних элементов (с направляющими),
 * иначе — к сетке. Всё в мировых координатах.
 */

export const GRID_SIZE = 24;
/** Порог прилипания в пикселях экрана; в мир переводится делением на зум. */
export const SNAP_THRESHOLD_PX = 6;

export interface SnapResult {
  /** Поправка к смещению. */
  readonly dx: number;
  readonly dy: number;
  readonly guides: readonly Guide[];
}

type Axis = 'x' | 'y';

function lines(rect: Rect, axis: Axis): readonly number[] {
  const start = axis === 'x' ? rect.x : rect.y;
  const size = axis === 'x' ? rect.width : rect.height;
  return [start, start + size / 2, start + size];
}

function span(rect: Rect, axis: Axis): readonly [number, number] {
  return axis === 'x' ? [rect.y, rect.y + rect.height] : [rect.x, rect.x + rect.width];
}

/** Ближайшая линия соседей в пределах порога и направляющая через все совпавшие элементы. */
function snapAxis(moving: Rect, others: readonly Rect[], axis: Axis, threshold: number) {
  let best: { correction: number; position: number } | null = null;
  for (const other of others) {
    for (const target of lines(other, axis)) {
      for (const source of lines(moving, axis)) {
        const correction = target - source;
        if (Math.abs(correction) > threshold) continue;
        if (best === null || Math.abs(correction) < Math.abs(best.correction))
          best = { correction, position: target };
      }
    }
  }
  if (best === null) return null;
  const position = best.position;
  const shifted =
    axis === 'x'
      ? { ...moving, x: moving.x + best.correction }
      : { ...moving, y: moving.y + best.correction };
  const matched = [
    shifted,
    ...others.filter((other) => lines(other, axis).some((line) => Math.abs(line - position) < 0.5)),
  ];
  const spans = matched.map((rect) => span(rect, axis));
  const guide: Guide = {
    axis,
    position,
    from: Math.min(...spans.map(([from]) => from)),
    to: Math.max(...spans.map(([, to]) => to)),
  };
  return { correction: best.correction, guide };
}

export function snapToGrid(value: number, grid = GRID_SIZE): number {
  return Math.round(value / grid) * grid;
}

/** moving — прямоугольник группы уже со смещением; others — соседи (без перетаскиваемых). */
export function snapMove(
  moving: Rect,
  others: readonly Rect[],
  threshold: number,
  grid: number | null,
): SnapResult {
  const x = snapAxis(moving, others, 'x', threshold);
  const y = snapAxis(moving, others, 'y', threshold);
  const guides = [x?.guide, y?.guide].filter((guide): guide is Guide => guide !== undefined);
  const gridX = grid === null ? 0 : snapToGrid(moving.x, grid) - moving.x;
  const gridY = grid === null ? 0 : snapToGrid(moving.y, grid) - moving.y;
  return { dx: x?.correction ?? gridX, dy: y?.correction ?? gridY, guides };
}
