import type { MindMapForest } from './forest';

/** Рамка узла в мировых координатах. */
export interface NodeBox {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface NodePosition {
  readonly x: number;
  readonly y: number;
}

/** Отступы раскладки в мировых единицах: между уровнями и между соседними ветками. */
export const MIND_MAP_LEVEL_GAP = 80;
export const MIND_MAP_DOWN_LEVEL_GAP = 64;
export const MIND_MAP_SIBLING_GAP = 24;

/** Ось раскладки: main — от родителя к детям, cross — вдоль ряда братьев. */
interface Axis {
  readonly main: 'x' | 'y';
  readonly cross: 'x' | 'y';
  readonly mainSize: 'width' | 'height';
  readonly crossSize: 'width' | 'height';
  readonly levelGap: number;
}

const HORIZONTAL: Axis = {
  main: 'x',
  cross: 'y',
  mainSize: 'width',
  crossSize: 'height',
  levelGap: MIND_MAP_LEVEL_GAP,
};
const VERTICAL: Axis = {
  main: 'y',
  cross: 'x',
  mainSize: 'height',
  crossSize: 'width',
  levelGap: MIND_MAP_DOWN_LEVEL_GAP,
};

const EMPTY_BOX: NodeBox = { x: 0, y: 0, width: 0, height: 0 };

interface Context {
  readonly forest: MindMapForest;
  readonly boxOf: (id: string) => NodeBox | undefined;
  readonly axis: Axis;
  readonly extents: Map<string, number>;
  readonly out: Map<string, NodePosition>;
}

const box = (context: Context, id: string): NodeBox => context.boxOf(id) ?? EMPTY_BOX;

/** Видимые дети: у свёрнутого узла их нет (ветки не занимают места). */
function visibleChildren(forest: MindMapForest, id: string): readonly string[] {
  const node = forest.nodes.get(id);
  return node === undefined || node.link.collapsed ? [] : node.children;
}

/** Размер ветки поперёк направления: сам узел или ряд детей, что больше. */
function extent(context: Context, id: string): number {
  const cached = context.extents.get(id);
  if (cached !== undefined) return cached;
  const kids = visibleChildren(context.forest, id);
  const own = box(context, id)[context.axis.crossSize];
  const row = kids.reduce((sum, kid) => sum + extent(context, kid), 0);
  const value = Math.max(own, row + MIND_MAP_SIBLING_GAP * Math.max(0, kids.length - 1));
  context.extents.set(id, value);
  return value;
}

/** Ставит ряд детей по сторону sign от родителя (+1 — вправо или вниз, −1 — влево). */
function placeChildren(context: Context, parent: NodeBox, kids: readonly string[], sign: 1 | -1) {
  if (kids.length === 0) return;
  const { axis } = context;
  const near =
    sign > 0
      ? parent[axis.main] + parent[axis.mainSize] + axis.levelGap
      : parent[axis.main] - axis.levelGap;
  const row =
    kids.reduce((sum, kid) => sum + extent(context, kid), 0) +
    MIND_MAP_SIBLING_GAP * (kids.length - 1);
  let start = parent[axis.cross] + parent[axis.crossSize] / 2 - row / 2;
  for (const kid of kids) {
    const size = extent(context, kid);
    placeNode(context, kid, near, start + size / 2, sign);
    start += size + MIND_MAP_SIBLING_GAP;
  }
}

/** Узел: ближний край к родителю и центр поперёк; ручной сдвиг двигает его вместе с веткой. */
function placeNode(context: Context, id: string, near: number, center: number, sign: 1 | -1) {
  const { axis } = context;
  const own = box(context, id);
  const main = sign > 0 ? near : near - own[axis.mainSize];
  const cross = center - own[axis.crossSize] / 2;
  const offset = context.forest.nodes.get(id)?.link.offset ?? null;
  const base = axis.main === 'x' ? { x: main, y: cross } : { x: cross, y: main };
  const position = { x: base.x + (offset?.dx ?? 0), y: base.y + (offset?.dy ?? 0) };
  context.out.set(id, position);
  placeChildren(context, { ...own, ...position }, visibleChildren(context.forest, id), sign);
}

/**
 * Позиции видимых узлов карты (кроме корня — он стоит, где стоит). Одинаковые данные дают
 * одинаковые позиции на всех устройствах (ADR 0011). Свёрнутые ветки не трогаются.
 */
export function layoutMindMap(
  forest: MindMapForest,
  rootId: string,
  boxOf: (id: string) => NodeBox | undefined,
): Map<string, NodePosition> {
  const root = forest.nodes.get(rootId);
  const out = new Map<string, NodePosition>();
  const rootBox = boxOf(rootId);
  if (root === undefined || rootBox === undefined) return out;
  const direction = root.link.direction ?? 'right';
  const axis = direction === 'down' ? VERTICAL : HORIZONTAL;
  const context: Context = { forest, boxOf, axis, extents: new Map(), out };
  const kids = visibleChildren(forest, rootId);
  if (direction !== 'both') {
    placeChildren(context, rootBox, kids, 1);
    return out;
  }
  const sideOf = (id: string) => forest.nodes.get(id)?.link.side ?? 'right';
  placeChildren(
    context,
    rootBox,
    kids.filter((id) => sideOf(id) === 'right'),
    1,
  );
  placeChildren(
    context,
    rootBox,
    kids.filter((id) => sideOf(id) === 'left'),
    -1,
  );
  return out;
}
