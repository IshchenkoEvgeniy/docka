import type { InteractionState, Rect } from '../../canvas';
import type { BoardElement } from '../../core';

export type Preview = Pick<InteractionState, 'drag' | 'resize'>;

/** Прямоугольник элемента с учётом перетаскивания; у карточки в колонке — сама колонка. */
export function previewRect(
  elements: ReadonlyMap<string, BoardElement>,
  id: string,
  preview: Preview,
): Rect | null {
  const element = elements.get(id);
  if (element === undefined) return null;
  const parent = element.parentId === null ? undefined : elements.get(element.parentId);
  const target = parent ?? element;
  const base = preview.resize?.id === target.id ? preview.resize.rect : target;
  const drag = preview.drag;
  if (drag?.ids.has(target.id) !== true) return base;
  return { ...base, x: base.x + drag.dx, y: base.y + drag.dy };
}
