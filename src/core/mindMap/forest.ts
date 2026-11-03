import type { MindMapLink } from '../model';

/** То, что нужно о элементе для построения карт: всё остальное дереву не важно. */
export interface MindMapInput {
  readonly id: string;
  /** Удалённые элементы тоже передаются: через них ищется живой предок. */
  readonly deletedAt: number | null;
  readonly tree?: MindMapLink | null | undefined;
}

export interface MindMapNode {
  readonly id: string;
  /** Действующий родитель после починки; null — корень. */
  readonly parentId: string | null;
  /** Дети по порядку: `order`, при равенстве — id. */
  readonly children: readonly string[];
  readonly rootId: string;
  /** 0 у корня. */
  readonly depth: number;
  readonly link: MindMapLink;
}

/** Что пришлось починить: для журнала (ADR 0011). */
export interface MindMapRepair {
  readonly id: string;
  readonly kind: 'missingParent' | 'cycle';
}

export interface MindMapForest {
  /** Корни карт по id. */
  readonly roots: readonly string[];
  readonly nodes: ReadonlyMap<string, MindMapNode>;
  readonly repairs: readonly MindMapRepair[];
}

type Linked = MindMapInput & { readonly tree: MindMapLink };

const isLinked = (input: MindMapInput): input is Linked =>
  input.tree !== undefined && input.tree !== null;
const byId = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

/**
 * Ближайший живой предок по записанной цепочке `parentId`. Удалённые узлы пропускаются;
 * нет предка, он не узел карты или цепочка зациклилась на удалённых — корень.
 */
function livingParent(node: Linked, all: ReadonlyMap<string, Linked>): string | null {
  const seen = new Set<string>([node.id]);
  let parentId = node.tree.parentId;
  while (parentId !== null && !seen.has(parentId)) {
    const parent = all.get(parentId);
    if (parent === undefined) return null;
    if (parent.deletedAt === null) return parentId;
    seen.add(parentId);
    parentId = parent.tree.parentId;
  }
  return null;
}

/**
 * Рвёт циклы среди живых узлов: в каждом цикле корнем становится узел с наименьшим id.
 * Циклы в графе «узел → родитель» не пересекаются, поэтому порядок обхода не важен.
 */
function breakCycles(parents: Map<string, string | null>): string[] {
  const done = new Set<string>();
  const broken: string[] = [];
  for (const start of [...parents.keys()].sort(byId)) {
    const path: string[] = [];
    const onPath = new Set<string>();
    let current: string | null = start;
    while (current !== null && !done.has(current) && !onPath.has(current)) {
      path.push(current);
      onPath.add(current);
      current = parents.get(current) ?? null;
    }
    if (current !== null && onPath.has(current)) {
      const cycle = path.slice(path.indexOf(current));
      const root = [...cycle].sort(byId)[0] ?? current;
      parents.set(root, null);
      broken.push(root);
    }
    path.forEach((id) => done.add(id));
  }
  return broken;
}

function sortedChildren(
  parents: ReadonlyMap<string, string | null>,
  all: ReadonlyMap<string, Linked>,
): Map<string, string[]> {
  const children = new Map<string, string[]>();
  for (const [id, parentId] of parents) {
    if (parentId === null) continue;
    const list = children.get(parentId) ?? [];
    list.push(id);
    children.set(parentId, list);
  }
  const order = (id: string): number => all.get(id)?.tree.order ?? 0;
  for (const list of children.values()) {
    list.sort((a, b) => order(a) - order(b) || byId(a, b));
  }
  return children;
}

/** Строит карты доски из её элементов: одинаково на всех устройствах, с починкой (ADR 0011). */
export function buildMindMapForest(inputs: Iterable<MindMapInput>): MindMapForest {
  const all = new Map<string, Linked>();
  for (const input of inputs) if (isLinked(input)) all.set(input.id, input);

  const parents = new Map<string, string | null>();
  const repairs: MindMapRepair[] = [];
  for (const node of all.values()) {
    if (node.deletedAt !== null) continue;
    const parentId = livingParent(node, all);
    parents.set(node.id, parentId);
    if (parentId !== node.tree.parentId) repairs.push({ id: node.id, kind: 'missingParent' });
  }
  for (const id of breakCycles(parents)) repairs.push({ id, kind: 'cycle' });

  const children = sortedChildren(parents, all);
  const roots = [...parents].filter(([, parentId]) => parentId === null).map(([id]) => id);
  roots.sort(byId);
  const nodes = new Map<string, MindMapNode>();
  for (const rootId of roots) {
    const queue: { id: string; depth: number }[] = [{ id: rootId, depth: 0 }];
    for (let next = queue.shift(); next !== undefined; next = queue.shift()) {
      const link = all.get(next.id)?.tree;
      if (link === undefined) continue;
      const kids = children.get(next.id) ?? [];
      nodes.set(next.id, {
        id: next.id,
        parentId: parents.get(next.id) ?? null,
        children: kids,
        rootId,
        depth: next.depth,
        link,
      });
      kids.forEach((id) => queue.push({ id, depth: next.depth + 1 }));
    }
  }
  repairs.sort((a, b) => byId(a.id, b.id));
  return { roots, nodes, repairs };
}
