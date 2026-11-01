import {
  compareElementLayers,
  definitionFor,
  elementVisualRect,
  endpointInRegion,
  withRegionContents,
} from '../../elements';
import { boundsOf, connectorGeometry, type ConnectorEnd, type Rect } from '../../canvas';
import { type BoardElement, type Connection, type Endpoint } from '../../core';

export type ExportScope = 'board' | 'selection';
export const EXPORT_PADDING = 24;
export const MAX_EXPORT_SIDE = 8192;
export const MAX_EXPORT_PIXELS = 32 * 1024 * 1024;

export interface ExportSource {
  readonly elements: ReadonlyMap<string, BoardElement>;
  readonly connections: ReadonlyMap<string, Connection>;
  readonly selection: ReadonlySet<string>;
  readonly connectionSelection: ReadonlySet<string>;
  readonly measure?: (id: string) => Rect | null;
}

export interface ExportPlan {
  readonly elements: ReadonlyMap<string, BoardElement>;
  readonly geometryElements: ReadonlyMap<string, BoardElement>;
  readonly roots: readonly BoardElement[];
  readonly connections: readonly Connection[];
  readonly bounds: Rect;
}

export function exportEnd(
  elements: ReadonlyMap<string, BoardElement>,
  end: Endpoint,
): ConnectorEnd | null {
  if (end.kind === 'point') return { kind: 'point', point: end };
  const element = elements.get(end.elementId);
  if (element === undefined) return null;
  const parent = element.parentId === null ? undefined : elements.get(element.parentId);
  return { kind: 'rect', rect: parent ?? element, side: end.side };
}

function includeDescendants(
  elements: ReadonlyMap<string, BoardElement>,
  selected: Set<string>,
): void {
  let changed = true;
  while (changed) {
    changed = false;
    for (const element of elements.values()) {
      if (
        element.parentId !== null &&
        selected.has(element.parentId) &&
        !selected.has(element.id)
      ) {
        selected.add(element.id);
        changed = true;
      }
    }
  }
}

function connectionRects(
  connections: readonly Connection[],
  elements: ReadonlyMap<string, BoardElement>,
): Rect[] {
  return connections.flatMap((connection) => {
    const from = exportEnd(elements, connection.from);
    const to = exportEnd(elements, connection.to);
    if (from === null || to === null) return [];
    // Пути состоят из M/L/C: опорные точки кривой дают безопасную охватывающую рамку.
    const coordinates =
      connectorGeometry(from, to, connection.lineStyle)
        .path.match(/-?\d+(?:\.\d+)?/g)
        ?.map(Number) ?? [];
    const points: Rect[] = [];
    for (let index = 0; index + 1 < coordinates.length; index += 2) {
      points.push({
        x: coordinates[index] ?? 0,
        y: coordinates[index + 1] ?? 0,
        width: 0,
        height: 0,
      });
    }
    return points;
  });
}

function selectedElements(source: ExportSource, selected: ReadonlySet<string>) {
  return new Map(
    [...source.elements]
      .filter(([id]) => selected.has(id))
      .map(([id, element]) => {
        if (element.parentId === null || selected.has(element.parentId)) return [id, element];
        const parent = source.elements.get(element.parentId);
        const measured = source.measure?.(id);
        const siblings = [...source.elements.values()].filter(
          (item) => item.parentId === element.parentId && item.y < element.y,
        );
        const fallback = {
          x: parent?.x ?? element.x,
          y: (parent?.y ?? 0) + siblings.reduce((y, item) => y + item.height + 8, 44),
          width: parent?.width ?? element.width,
          height: element.height,
        };
        return [id, { ...element, ...(measured ?? fallback), parentId: null }];
      }),
  );
}

export function createExportPlan(source: ExportSource, scope: ExportScope): ExportPlan | null {
  const selected = new Set(scope === 'board' ? source.elements.keys() : source.selection);
  for (const item of withRegionContents(
    source.elements,
    [...source.elements.values()].filter((item) => selected.has(item.id)),
  ))
    selected.add(item.id);
  includeDescendants(source.elements, selected);
  const elements = selectedElements(source, selected);
  const roots = [...elements.values()]
    .filter((element) => element.parentId === null || !elements.has(element.parentId))
    .sort(compareElementLayers);
  const regions = roots.filter((element) => definitionFor(element.type).region);
  const connections = [...source.connections.values()]
    .filter((connection) => {
      if (scope === 'board') return true;
      if (source.connectionSelection.has(connection.id)) return true;
      if (
        regions.some(
          (region) =>
            endpointInRegion(source.elements, region, connection.from) &&
            endpointInRegion(source.elements, region, connection.to),
        )
      )
        return true;
      return (
        connection.from.kind === 'element' &&
        connection.to.kind === 'element' &&
        selected.has(connection.from.elementId) &&
        selected.has(connection.to.elementId)
      );
    })
    .filter(
      (connection) =>
        exportEnd(source.elements, connection.from) !== null &&
        exportEnd(source.elements, connection.to) !== null,
    );
  const bounds = boundsOf([
    ...roots.map(elementVisualRect),
    ...connectionRects(connections, source.elements),
  ]);
  if (bounds === null) return null;
  return {
    elements,
    geometryElements: source.elements,
    roots,
    connections,
    bounds: paddedBounds(bounds),
  };
}

export function paddedBounds(bounds: Rect): Rect {
  return {
    x: bounds.x - EXPORT_PADDING,
    y: bounds.y - EXPORT_PADDING,
    width: Math.ceil(bounds.width + EXPORT_PADDING * 2),
    height: Math.ceil(bounds.height + EXPORT_PADDING * 2),
  };
}

export function exportFits(bounds: Rect, scale: number): boolean {
  const width = Math.ceil(bounds.width * scale);
  const height = Math.ceil(bounds.height * scale);
  return (
    [1, 2, 3].includes(scale) &&
    width > 0 &&
    height > 0 &&
    Number.isFinite(width * height) &&
    width <= MAX_EXPORT_SIDE &&
    height <= MAX_EXPORT_SIDE &&
    width * height <= MAX_EXPORT_PIXELS
  );
}

export function exportFileName(title: string): string {
  const clean = title.replace(/\p{Cc}/gu, '_');
  const safe = clean
    .replace(/[<>:"/\\|?*]/g, '_')
    .replace(/[. ]+$/g, '')
    .slice(0, 100);
  return `${safe || 'Doska'}.png`;
}
