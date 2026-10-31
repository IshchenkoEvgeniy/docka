import { boundsOf, type Rect } from './geometry';

/** Выравнивание и распределение выделенного (ТЗ, раздел 4). Результат — новые позиции. */

export type AlignMode = 'left' | 'centerX' | 'right' | 'top' | 'centerY' | 'bottom';
export type DistributeAxis = 'horizontal' | 'vertical';

export interface Placed {
  readonly id: string;
  readonly rect: Rect;
}

export interface Move {
  readonly id: string;
  readonly x: number;
  readonly y: number;
}

function alignedPosition(rect: Rect, bounds: Rect, mode: AlignMode): { x: number; y: number } {
  switch (mode) {
    case 'left':
      return { x: bounds.x, y: rect.y };
    case 'centerX':
      return { x: bounds.x + (bounds.width - rect.width) / 2, y: rect.y };
    case 'right':
      return { x: bounds.x + bounds.width - rect.width, y: rect.y };
    case 'top':
      return { x: rect.x, y: bounds.y };
    case 'centerY':
      return { x: rect.x, y: bounds.y + (bounds.height - rect.height) / 2 };
    case 'bottom':
      return { x: rect.x, y: bounds.y + bounds.height - rect.height };
  }
}

/** Выравнивает по краю или центру общей рамки; неподвижные элементы в ответ не попадают. */
export function align(items: readonly Placed[], mode: AlignMode): Move[] {
  const bounds = boundsOf(items.map((item) => item.rect));
  if (bounds === null || items.length < 2) return [];
  return items
    .map((item) => ({ id: item.id, ...alignedPosition(item.rect, bounds, mode) }))
    .filter((move, index) => {
      const rect = items[index]?.rect;
      return rect !== undefined && (rect.x !== move.x || rect.y !== move.y);
    });
}

/** Равные промежутки между элементами; крайние остаются на месте. */
export function distribute(items: readonly Placed[], axis: DistributeAxis): Move[] {
  if (items.length < 3) return [];
  const horizontal = axis === 'horizontal';
  const start = (rect: Rect) => (horizontal ? rect.x : rect.y);
  const size = (rect: Rect) => (horizontal ? rect.width : rect.height);
  const sorted = [...items].sort((a, b) => start(a.rect) - start(b.rect));
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  if (first === undefined || last === undefined) return [];
  const total = start(last.rect) + size(last.rect) - start(first.rect);
  const occupied = sorted.reduce((sum, item) => sum + size(item.rect), 0);
  const gap = (total - occupied) / (sorted.length - 1);
  const moves: Move[] = [];
  let cursor = start(first.rect);
  for (const item of sorted) {
    if (cursor !== start(item.rect)) {
      moves.push({
        id: item.id,
        x: horizontal ? cursor : item.rect.x,
        y: horizontal ? item.rect.y : cursor,
      });
    }
    cursor += size(item.rect) + gap;
  }
  return moves;
}
