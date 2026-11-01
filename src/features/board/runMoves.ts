import type { Move } from '../../canvas';
import type { ElementId } from '../../core';
import type { BoardModel } from './model';
import { expandRegionMoves, regionConnectionMoves } from './regionMoves';

export function runMoves(
  model: BoardModel,
  moves: readonly Move[],
  mode: 'selection' | 'regionDrop' = 'selection',
): void {
  if (moves.length === 0) return;
  const elements = model.elements.getSnapshot();
  const captured = mode === 'regionDrop';
  const expanded = captured ? moves : expandRegionMoves(elements, moves);
  model.run({
    kind: 'moveElements',
    moves: expanded.map((move) => ({
      elementId: move.id as ElementId,
      x: move.x,
      y: move.y,
      ...(captured ? { parentId: null } : {}),
    })), // id из снимка доски
    connections: regionConnectionMoves(
      elements,
      model.connections.getSnapshot().values(),
      expanded,
    ),
  });
}
