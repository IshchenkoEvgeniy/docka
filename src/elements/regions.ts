import { containsPoint, type Rect } from '../canvas';
import { compareStacking, type BoardElement, type Endpoint } from '../core';
import { definitionFor } from './registry';

export function encloses(region: Rect, item: Rect): boolean {
  return (
    item.x >= region.x &&
    item.y >= region.y &&
    item.x + item.width <= region.x + region.width &&
    item.y + item.height <= region.y + region.height
  );
}

/** В статическом представлении заголовок зоны занимает 44 мировые единицы над границей. */
export function elementVisualRect(element: BoardElement): Rect {
  return definitionFor(element.type).region
    ? { ...element, y: element.y - 44, height: element.height + 44 }
    : element;
}

export function endpointInRegion(
  all: ReadonlyMap<string, BoardElement>,
  region: BoardElement,
  end: Endpoint,
): boolean {
  if (end.kind === 'point') return containsPoint(region, end);
  const item = all.get(end.elementId);
  if (item === undefined) return false;
  const parent = item.parentId === null ? undefined : all.get(item.parentId);
  return encloses(region, parent ?? item);
}

/** Зоны ниже карточек; большие зоны ниже маленьких независимо от порядка создания. */
export function compareElementLayers(a: BoardElement, b: BoardElement): number {
  const ar = definitionFor(a.type).region;
  const br = definitionFor(b.type).region;
  if (ar !== br) return ar ? -1 : 1;
  if (ar) return b.width * b.height - a.width * a.height || compareStacking(a, b);
  return compareStacking(a, b);
}

/** Геометрические участники зоны. Дети колонок остаются в координатах своих колонок. */
export function withRegionContents(
  all: ReadonlyMap<string, BoardElement>,
  selected: readonly BoardElement[],
): BoardElement[] {
  const regions = selected.filter((item) => definitionFor(item.type).region);
  const result = new Map(selected.map((item) => [item.id, item]));
  for (const item of all.values()) {
    if (item.parentId === null && regions.some((region) => encloses(region, item)))
      result.set(item.id, item);
  }
  return [...result.values()].sort(compareElementLayers);
}
