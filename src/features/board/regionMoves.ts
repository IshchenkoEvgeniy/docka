import type { Move } from '../../canvas';
import type { BoardElement, Connection, Endpoint } from '../../core';
import { definitionFor, encloses, endpointInRegion } from '../../elements';

/** Большая выбранная зона управляет сдвигом своих участников; одинаковые зоны — по id. */
export function movingRegions(elements: ReadonlyMap<string, BoardElement>, moves: readonly Move[]) {
  return moves
    .flatMap((move) => {
      const region = elements.get(move.id);
      return region !== undefined && definitionFor(region.type).region
        ? [{ region, dx: move.x - region.x, dy: move.y - region.y }]
        : [];
    })
    .sort(
      (a, b) =>
        b.region.width * b.region.height - a.region.width * a.region.height ||
        a.region.id.localeCompare(b.region.id),
    );
}

export function expandRegionMoves(
  elements: ReadonlyMap<string, BoardElement>,
  moves: readonly Move[],
): Move[] {
  const regions = movingRegions(elements, moves);
  const result = new Map(moves.map((move) => [move.id, move]));
  for (const element of elements.values()) {
    if (element.parentId !== null) continue;
    const owner = regions.find(({ region }) => encloses(region, element));
    if (owner !== undefined)
      result.set(element.id, { id: element.id, x: element.x + owner.dx, y: element.y + owner.dy });
  }
  // Карточки колонки уже едут вместе с ней; их локальный порядок сохраняется.
  return [...result.values()].filter((move) => {
    const parentId = elements.get(move.id)?.parentId;
    return parentId === null || parentId === undefined || !result.has(parentId);
  });
}

const shifted = (end: Endpoint, dx: number, dy: number): Endpoint =>
  end.kind === 'point' ? { ...end, x: end.x + dx, y: end.y + dy } : end;

export function regionConnectionMoves(
  elements: ReadonlyMap<string, BoardElement>,
  connections: Iterable<Connection>,
  moves: readonly Move[],
) {
  const regions = movingRegions(elements, moves);
  if (regions.length === 0) return [];
  return [...connections].flatMap((connection) => {
    if (connection.from.kind !== 'point' && connection.to.kind !== 'point') return [];
    const owner = regions.find(
      ({ region }) =>
        endpointInRegion(elements, region, connection.from) &&
        endpointInRegion(elements, region, connection.to),
    );
    return owner === undefined
      ? []
      : [
          {
            connectionId: connection.id,
            from: shifted(connection.from, owner.dx, owner.dy),
            to: shifted(connection.to, owner.dx, owner.dy),
          },
        ];
  });
}
