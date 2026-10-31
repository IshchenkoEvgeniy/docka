import { intersects, type Rect } from './geometry';

/**
 * Правила выделения (ТЗ, раздел 4). Нажатие на элемент сразу показывает выделение,
 * а окончательное решение принимается при отпускании, если не было перетаскивания:
 * так можно потащить группу за любой её элемент.
 */

/** Что сделать при отпускании без перетаскивания. */
export type DeferredSelection = 'none' | 'selectOnly' | 'remove';

export interface PressResult {
  readonly selection: ReadonlySet<string>;
  readonly deferred: DeferredSelection;
}

export function pressSelection(
  selection: ReadonlySet<string>,
  id: string,
  additive: boolean,
): PressResult {
  const selected = selection.has(id);
  if (additive) {
    return selected
      ? { selection, deferred: 'remove' }
      : { selection: new Set([...selection, id]), deferred: 'none' };
  }
  if (selected) return { selection, deferred: selection.size > 1 ? 'selectOnly' : 'none' };
  return { selection: new Set([id]), deferred: 'none' };
}

export function releaseSelection(
  selection: ReadonlySet<string>,
  id: string,
  deferred: DeferredSelection,
): ReadonlySet<string> {
  if (deferred === 'selectOnly') return new Set([id]);
  if (deferred === 'remove') return new Set([...selection].filter((other) => other !== id));
  return selection;
}

/** Выделение рамкой: всё, что пересекает рамку; с Shift — добавляется к прежнему выделению. */
export function selectionInRect(
  items: Iterable<{ readonly id: string; readonly rect: Rect }>,
  marquee: Rect,
  base: ReadonlySet<string>,
): ReadonlySet<string> {
  const result = new Set(base);
  for (const item of items) if (intersects(item.rect, marquee)) result.add(item.id);
  return result;
}
