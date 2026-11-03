import { err, ok, type Result } from '../result';
import {
  branchOf,
  buildMindMapForest,
  isInBranch,
  lighterSide,
  orderAfter,
  orderAfterLast,
  type MindMapForest,
  type MindMapNode,
} from '../mindMap';
import type { BoardElement, BoardId, MindMapLink, RichNode } from '../model';
import type { CommandEnvironment } from './environment';
import type { MindMapCommand } from './mindMapCommandTypes';
import { planElement } from './plan';

/** Что записать: новая карточка, правки полей, корзина и какие карты разложить заново. */
export interface MindMapPlan {
  readonly create?: { readonly element: BoardElement; readonly richText?: readonly RichNode[] };
  readonly patches: readonly { readonly id: string; readonly changes: Record<string, unknown> }[];
  /** В корзину обычным удалением: вместе с ветками и привязанными стрелками. */
  readonly trash: readonly string[];
  /** Узлы, чьи карты разложить после записи (и до неё — корни, из которых они ушли). */
  readonly relayout: readonly string[];
}

export interface MindMapPlanContext {
  readonly boardId: BoardId;
  readonly topZ: number;
  readonly environment: CommandEnvironment;
}

type Of<K extends MindMapCommand['kind']> = Extract<MindMapCommand, { kind: K }>;
type Patch = MindMapPlan['patches'][number];

interface State {
  readonly forest: MindMapForest;
  readonly byId: ReadonlyMap<string, BoardElement>;
}

const NOT_NODE = 'Это не узел майнд-карты';
const plan = (patches: Patch[], relayout: string[], trash: string[] = []): MindMapPlan => ({
  patches,
  relayout,
  trash,
});

function living(state: State, id: string): Result<BoardElement> {
  const element = state.byId.get(id);
  return element?.deletedAt === null ? ok(element) : err('Элемент не найден');
}

function nodeOf(state: State, id: string): Result<MindMapNode> {
  const node = state.forest.nodes.get(id);
  return node === undefined ? err(NOT_NODE) : ok(node);
}

const newLink = (parentId: string | null, order: number): MindMapLink => ({
  parentId: parentId as MindMapLink['parentId'], // id живого узла этой доски
  order,
  collapsed: false,
  offset: null,
});

/** Сторона для новой ветки, если родитель — корень «в обе стороны». */
function sideFor(state: State, parentId: string): Partial<MindMapLink> {
  const parent = state.forest.nodes.get(parentId);
  if (parent?.parentId !== null || parent.link.direction !== 'both') return {};
  return { side: lighterSide(state.forest, parentId) };
}

function makeRoot(state: State, command: Of<'makeMindMapRoot'>): Result<MindMapPlan> {
  const element = living(state, command.elementId);
  if (!element.ok) return element;
  if (element.value.parentId !== null) return err('Карточка в колонке не может быть корнем карты');
  if (state.forest.nodes.has(command.elementId)) return err('Карточка уже в майнд-карте');
  const tree = { ...newLink(null, 0), direction: command.direction ?? 'right' };
  return ok(plan([{ id: command.elementId, changes: { tree } }], []));
}

function addNode(
  state: State,
  command: Of<'addMindMapNode'>,
  context: MindMapPlanContext,
): Result<MindMapPlan> {
  const anchor = nodeOf(state, command.anchorId);
  if (!anchor.ok) return anchor;
  const parentId =
    command.relation === 'child' || anchor.value.parentId === null
      ? command.anchorId
      : anchor.value.parentId;
  const asChild = parentId === command.anchorId;
  const order = asChild
    ? orderAfterLast(state.forest, parentId)
    : orderAfter(state.forest, command.anchorId);
  const side = asChild ? sideFor(state, parentId) : pickSide(anchor.value);
  const color = command.element.color ?? state.byId.get(parentId)?.color;
  const spec = { ...command.element, parentId: null, ...(color === undefined ? {} : { color }) };
  const element = planElement(spec, context.boardId, context.topZ, context.environment);
  if (!element.ok) return element;
  const tree: MindMapLink = { ...newLink(parentId, order), ...side };
  return ok({
    create: {
      element: { ...element.value, tree },
      ...(command.element.richText === undefined ? {} : { richText: command.element.richText }),
    },
    patches: [],
    trash: [],
    relayout: [parentId],
  });
}

const pickSide = (node: MindMapNode): Partial<MindMapLink> =>
  node.link.side === undefined ? {} : { side: node.link.side };

function attach(state: State, command: Of<'attachToMindMap'>): Result<MindMapPlan> {
  const parent = nodeOf(state, command.parentId);
  if (!parent.ok) return parent;
  const patches: Patch[] = [];
  let order = orderAfterLast(state.forest, command.parentId);
  const side = sideFor(state, command.parentId);
  const oldRoots: string[] = [];
  for (const id of command.elementIds) {
    const element = living(state, id);
    if (!element.ok) return element;
    if (isInBranch(state.forest, id, command.parentId))
      return err('Нельзя прицепить ветку к самой себе');
    const current = state.forest.nodes.get(id);
    if (current !== undefined) oldRoots.push(current.rootId);
    const tree =
      current === undefined
        ? newLink(command.parentId, order)
        : { parentId: command.parentId, order, offset: null };
    patches.push({ id, changes: { tree: { ...tree, ...side }, parentId: null } });
    order += 1;
  }
  return ok(plan(patches, [command.parentId, ...oldRoots]));
}

/** Ветки узла переходят к его родителю на его место, в своём порядке. */
function liftChildren(state: State, node: MindMapNode): Patch[] {
  if (node.parentId === null || node.children.length === 0) return [];
  const next = orderAfter(state.forest, node.id);
  const step = (next - node.link.order) / node.children.length;
  return node.children.map((id, index) => ({
    id,
    changes: {
      tree: { parentId: node.parentId, order: node.link.order + step * index, ...pickSide(node) },
    },
  }));
}

function detach(state: State, command: Of<'detachMindMapBranch'>): Result<MindMapPlan> {
  const node = nodeOf(state, command.elementId);
  if (!node.ok) return node;
  if (node.value.parentId === null) return err('Это уже отдельная карта');
  const direction = state.forest.nodes.get(node.value.rootId)?.link.direction ?? 'right';
  const tree = { parentId: null, offset: null, direction };
  return ok(
    plan([{ id: command.elementId, changes: { tree } }], [node.value.rootId, command.elementId]),
  );
}

function remove(state: State, command: Of<'removeFromMindMap'>): Result<MindMapPlan> {
  const node = nodeOf(state, command.elementId);
  if (!node.ok) return node;
  if (node.value.parentId === null) return err('Корень убирается вместе с картой');
  const patches = [
    ...liftChildren(state, node.value),
    { id: command.elementId, changes: { tree: null } },
  ];
  return ok(plan(patches, [node.value.rootId]));
}

function dissolve(state: State, command: Of<'dissolveMindMap'>): Result<MindMapPlan> {
  const node = nodeOf(state, command.rootId);
  if (!node.ok) return node;
  if (node.value.parentId !== null) return err('Это не корень карты');
  const ids = branchOf(state.forest, command.rootId);
  return ok(
    plan(
      ids.map((id) => ({ id, changes: { tree: null } })),
      [],
    ),
  );
}

function deleteNode(state: State, command: Of<'deleteMindMapNode'>): Result<MindMapPlan> {
  const node = nodeOf(state, command.elementId);
  if (!node.ok) return node;
  if (command.mode === 'branch') return ok(plan([], [node.value.rootId], [command.elementId]));
  if (node.value.parentId === null) {
    // Только корень: остальные карточки карты остаются на доске обычными.
    const rest = branchOf(state.forest, command.elementId).filter((id) => id !== command.elementId);
    return ok(
      plan(
        rest.map((id) => ({ id, changes: { tree: null } })),
        [],
        [command.elementId],
      ),
    );
  }
  return ok(plan(liftChildren(state, node.value), [node.value.rootId], [command.elementId]));
}

function setLink(
  state: State,
  id: string,
  changes: Partial<MindMapLink>,
  rootOnly: boolean,
): Result<MindMapPlan> {
  const node = nodeOf(state, id);
  if (!node.ok) return node;
  if (rootOnly && node.value.parentId !== null) return err('Это не корень карты');
  return ok(plan([{ id, changes: { tree: changes } }], [id]));
}

/** Планирует команду карты над элементами доски (включая удалённые). Ошибка — ничего не меняется. */
export function planMindMapCommand(
  elements: readonly BoardElement[],
  command: MindMapCommand,
  context: MindMapPlanContext,
): Result<MindMapPlan> {
  const state: State = {
    forest: buildMindMapForest(elements),
    byId: new Map(elements.map((element) => [element.id, element])),
  };
  switch (command.kind) {
    case 'makeMindMapRoot':
      return makeRoot(state, command);
    case 'addMindMapNode':
      return addNode(state, command, context);
    case 'attachToMindMap':
      return attach(state, command);
    case 'detachMindMapBranch':
      return detach(state, command);
    case 'removeFromMindMap':
      return remove(state, command);
    case 'dissolveMindMap':
      return dissolve(state, command);
    case 'deleteMindMapNode':
      return deleteNode(state, command);
    case 'setMindMapCollapsed':
      return setLink(state, command.elementId, { collapsed: command.collapsed }, false);
    case 'setMindMapDirection':
      return setLink(state, command.rootId, { direction: command.direction }, true);
    case 'setMindMapOffset':
      return setLink(state, command.elementId, { offset: command.offset }, false);
  }
}
