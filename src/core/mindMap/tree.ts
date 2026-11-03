import type { MindMapSide } from '../model';
import type { MindMapForest } from './forest';

/** Узел и все его потомки (включая свёрнутые), сам узел первым. */
export function branchOf(forest: MindMapForest, id: string): string[] {
  const result: string[] = [];
  const queue = [id];
  for (let next = queue.shift(); next !== undefined; next = queue.shift()) {
    const node = forest.nodes.get(next);
    if (node === undefined) continue;
    result.push(next);
    queue.push(...node.children);
  }
  return result;
}

/** ancestorId — сам id или его предок в карте. */
export function isInBranch(forest: MindMapForest, ancestorId: string, id: string): boolean {
  for (let current: string | null = id; current !== null;) {
    if (current === ancestorId) return true;
    current = forest.nodes.get(current)?.parentId ?? null;
  }
  return false;
}

/** Порядок для нового последнего ребёнка. */
export function orderAfterLast(forest: MindMapForest, parentId: string): number {
  const children = forest.nodes.get(parentId)?.children ?? [];
  const last = children[children.length - 1];
  return last === undefined ? 0 : (forest.nodes.get(last)?.link.order ?? 0) + 1;
}

/** Порядок сразу после узла: середина между ним и следующим братом. */
export function orderAfter(forest: MindMapForest, id: string): number {
  const node = forest.nodes.get(id);
  if (node === undefined) return 0;
  const siblings = node.parentId === null ? [] : (forest.nodes.get(node.parentId)?.children ?? []);
  const next = siblings[siblings.indexOf(id) + 1];
  const nextOrder = next === undefined ? undefined : forest.nodes.get(next)?.link.order;
  return nextOrder === undefined ? node.link.order + 1 : (node.link.order + nextOrder) / 2;
}

/** Сторона новой ветки корня «в обе стороны»: где узлов меньше, при равенстве — справа. */
export function lighterSide(forest: MindMapForest, rootId: string): MindMapSide {
  let left = 0;
  let right = 0;
  for (const child of forest.nodes.get(rootId)?.children ?? []) {
    const size = branchOf(forest, child).length;
    if (forest.nodes.get(child)?.link.side === 'left') left += size;
    else right += size;
  }
  return left < right ? 'left' : 'right';
}
