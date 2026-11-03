import { branchOf, buildMindMapForest, type BoardElement, type MindMapForest } from '../../core';
import type { BoardElementsStore } from '../../data';

/** Карты доски для интерфейса: дерево по всем элементам и что скрыто свёрнутыми ветками. */
export interface MindMapSnapshot {
  readonly forest: MindMapForest;
  /** Узлы внутри свёрнутых веток: не рисуются, не выделяются, не попадают в экспорт. */
  readonly hidden: ReadonlySet<string>;
  /** Все элементы доски, включая скрытые (копирование ветки целиком). */
  readonly elements: ReadonlyMap<string, BoardElement>;
}

const NO_MAPS = buildMindMapForest([]);

function snapshotOf(elements: ReadonlyMap<string, BoardElement>): MindMapSnapshot {
  let any = false;
  for (const element of elements.values()) {
    if (element.tree !== undefined && element.tree !== null) {
      any = true;
      break;
    }
  }
  if (!any) return { forest: NO_MAPS, hidden: new Set(), elements };
  const forest = buildMindMapForest(elements.values());
  const hidden = new Set<string>();
  for (const node of forest.nodes.values()) {
    if (!node.link.collapsed) continue;
    for (const id of branchOf(forest, node.id)) if (id !== node.id) hidden.add(id);
  }
  return { forest, hidden, elements };
}

export interface MindMapView {
  /** Элементы без скрытых свёрнутыми ветками; объекты элементов — те же, что в исходном снимке. */
  readonly visible: BoardElementsStore;
  readonly maps: {
    readonly getSnapshot: () => MindMapSnapshot;
    readonly subscribe: (listener: () => void) => () => void;
  };
}

/**
 * Обёртка над элементами доски: пересчитывается, только когда изменился исходный снимок.
 * Холст, выделение, поиск по доске и экспорт видят только видимые элементы.
 */
export function createMindMapView(source: BoardElementsStore): MindMapView {
  let base: ReadonlyMap<string, BoardElement> | null = null;
  let maps: MindMapSnapshot = { forest: NO_MAPS, hidden: new Set(), elements: new Map() };
  let visible: ReadonlyMap<string, BoardElement> = new Map();
  const refresh = (): void => {
    const current = source.getSnapshot();
    if (current === base) return;
    base = current;
    maps = snapshotOf(current);
    visible =
      maps.hidden.size === 0
        ? current
        : new Map([...current].filter(([id]) => !maps.hidden.has(id)));
  };
  const read = <T>(pick: () => T) => {
    refresh();
    return pick();
  };
  return {
    visible: {
      getSnapshot: () => read(() => visible),
      invalidCount: source.invalidCount,
      subscribe: source.subscribe,
      destroy: source.destroy,
    },
    maps: {
      getSnapshot: () => read(() => maps),
      subscribe: source.subscribe,
    },
  };
}
