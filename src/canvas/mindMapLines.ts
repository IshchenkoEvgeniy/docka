import { buildMindMapForest, type BoardElement, type ColorName } from '../core';
import { connectorGeometry, type Side } from './connectors';
import type { Rect } from './geometry';

/** Линия ветви майнд-карты: от родителя к ребёнку, цвета ребёнка (ADR 0011). */
export interface MindMapBranch {
  readonly childId: string;
  readonly path: string;
  readonly color: ColorName;
}

const center = (rect: Rect) => ({ x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 });

/** Стороны: у карты «вниз» — снизу вверх, иначе — к той стороне, где ребёнок. */
function sides(parent: Rect, child: Rect, down: boolean): readonly [Side, Side] {
  if (down) return ['bottom', 'top'];
  return center(child).x >= center(parent).x ? ['right', 'left'] : ['left', 'right'];
}

/**
 * Линии ветвей между элементами, которые есть в снимке: свёрнутые и скрытые ветки
 * отсутствуют в снимке — их линий нет. rectOf даёт рамку с учётом перетаскивания.
 */
export function mindMapBranches(
  elements: ReadonlyMap<string, BoardElement>,
  rectOf: (id: string) => Rect | null = (id) => elements.get(id) ?? null,
): MindMapBranch[] {
  const forest = buildMindMapForest(elements.values());
  const branches: MindMapBranch[] = [];
  for (const node of forest.nodes.values()) {
    if (node.parentId === null) continue;
    const child = elements.get(node.id);
    const parentRect = rectOf(node.parentId);
    const childRect = rectOf(node.id);
    if (child === undefined || parentRect === null || childRect === null) continue;
    const down = forest.nodes.get(node.rootId)?.link.direction === 'down';
    const [from, to] = sides(parentRect, childRect, down);
    const geometry = connectorGeometry(
      { kind: 'rect', rect: parentRect, side: from },
      { kind: 'rect', rect: childRect, side: to },
      'curved',
    );
    branches.push({ childId: node.id, path: geometry.path, color: child.color });
  }
  return branches;
}
