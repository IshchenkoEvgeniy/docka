import type { MindMapForest } from './forest';
import { isInBranch } from './tree';

export interface ElementMove {
  readonly elementId: string;
  readonly x: number;
  readonly y: number;
}

export interface MindMapMoveSplit<M extends ElementMove> {
  /** Обычные карточки и корни карт: переносятся как есть. */
  readonly moves: readonly M[];
  /** Узлы, перенесённые рукой: сдвиг запоминается, позицию даст раскладка. */
  readonly offsets: readonly {
    readonly elementId: string;
    readonly dx: number;
    readonly dy: number;
  }[];
}

/**
 * Перенос узлов карты (ADR 0011): корень двигает всю карту; узел — запоминает ручной сдвиг
 * вместе с веткой. Узел, чей предок переносится тем же действием, следует за предком.
 */
export function splitMindMapMoves<M extends ElementMove>(
  forest: MindMapForest,
  moves: readonly M[],
  positionOf: (id: string) => { readonly x: number; readonly y: number } | undefined,
): MindMapMoveSplit<M> {
  const moved = moves.map((move) => move.elementId);
  const followsAncestor = (id: string) =>
    moved.some((other) => other !== id && isInBranch(forest, other, id));
  const result: M[] = [];
  const offsets: { elementId: string; dx: number; dy: number }[] = [];
  for (const move of moves) {
    const node = forest.nodes.get(move.elementId);
    if (node === undefined || node.parentId === null) {
      if (node === undefined || !followsAncestor(move.elementId)) result.push(move);
      continue;
    }
    const before = positionOf(move.elementId);
    if (followsAncestor(move.elementId) || before === undefined) continue;
    const current = node.link.offset ?? { dx: 0, dy: 0 };
    offsets.push({
      elementId: move.elementId,
      dx: current.dx + move.x - before.x,
      dy: current.dy + move.y - before.y,
    });
  }
  return { moves: result, offsets };
}
