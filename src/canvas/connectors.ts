import type { Point, Rect } from './geometry';

/**
 * Геометрия стрелок: точки крепления к прямоугольникам, путь SVG, середина для подписи,
 * направление на концах для наконечников. Без DOM.
 */

export type Side = 'top' | 'right' | 'bottom' | 'left';
export type AnchorSide = Side | 'auto';
export type LineStyle = 'straight' | 'curved' | 'elbow';

/** Конец стрелки: прямоугольник элемента (с выбранной стороной) или точка. */
export type ConnectorEnd =
  | { readonly kind: 'rect'; readonly rect: Rect; readonly side: AnchorSide }
  | { readonly kind: 'point'; readonly point: Point };

export interface ConnectorGeometry {
  readonly path: string;
  readonly start: Point;
  readonly end: Point;
  /** Середина линии — место подписи. */
  readonly middle: Point;
  /** Угол линии у начала и у конца (радианы, направление «наружу»), для наконечников. */
  readonly startAngle: number;
  readonly endAngle: number;
}

const NORMALS: Readonly<Record<Side, Point>> = {
  top: { x: 0, y: -1 },
  right: { x: 1, y: 0 },
  bottom: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
};

function centerOf(rect: Rect): Point {
  return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
}

function endCenter(end: ConnectorEnd): Point {
  return end.kind === 'point' ? end.point : centerOf(end.rect);
}

/** Сторона, обращённая к цели: по преобладающему направлению с учётом пропорций. */
export function facingSide(rect: Rect, toward: Point): Side {
  const center = centerOf(rect);
  const dx = (toward.x - center.x) / Math.max(1, rect.width);
  const dy = (toward.y - center.y) / Math.max(1, rect.height);
  if (Math.abs(dx) >= Math.abs(dy)) return dx >= 0 ? 'right' : 'left';
  return dy >= 0 ? 'bottom' : 'top';
}

function sidePoint(rect: Rect, side: Side): Point {
  switch (side) {
    case 'top':
      return { x: rect.x + rect.width / 2, y: rect.y };
    case 'right':
      return { x: rect.x + rect.width, y: rect.y + rect.height / 2 };
    case 'bottom':
      return { x: rect.x + rect.width / 2, y: rect.y + rect.height };
    case 'left':
      return { x: rect.x, y: rect.y + rect.height / 2 };
  }
}

interface Anchor {
  readonly point: Point;
  /** Направление выхода линии; null — свободная точка. */
  readonly normal: Point | null;
}

function anchor(end: ConnectorEnd, other: Point): Anchor {
  if (end.kind === 'point') return { point: end.point, normal: null };
  const side = end.side === 'auto' ? facingSide(end.rect, other) : end.side;
  return { point: sidePoint(end.rect, side), normal: NORMALS[side] };
}

const format = (value: number) => String(Math.round(value * 10) / 10);
const at = (point: Point) => `${format(point.x)} ${format(point.y)}`;

function towards(from: Point, to: Point): Point {
  const length = Math.hypot(to.x - from.x, to.y - from.y) || 1;
  return { x: (to.x - from.x) / length, y: (to.y - from.y) / length };
}

function curved(start: Anchor, end: Anchor): Omit<ConnectorGeometry, 'start' | 'end'> {
  const distance = Math.hypot(end.point.x - start.point.x, end.point.y - start.point.y);
  const reach = Math.max(30, distance / 3);
  const startDir = start.normal ?? towards(start.point, end.point);
  const endDir = end.normal ?? towards(end.point, start.point);
  const c1 = { x: start.point.x + startDir.x * reach, y: start.point.y + startDir.y * reach };
  const c2 = { x: end.point.x + endDir.x * reach, y: end.point.y + endDir.y * reach };
  // Середина кубической кривой при t = 0,5.
  const middle = {
    x: (start.point.x + 3 * c1.x + 3 * c2.x + end.point.x) / 8,
    y: (start.point.y + 3 * c1.y + 3 * c2.y + end.point.y) / 8,
  };
  return {
    path: `M ${at(start.point)} C ${at(c1)} ${at(c2)} ${at(end.point)}`,
    middle,
    startAngle: Math.atan2(start.point.y - c1.y, start.point.x - c1.x),
    endAngle: Math.atan2(end.point.y - c2.y, end.point.x - c2.x),
  };
}

function elbow(start: Anchor, end: Anchor): Omit<ConnectorGeometry, 'start' | 'end'> {
  const horizontal = start.normal === null ? true : start.normal.y === 0;
  const a = start.point;
  const b = end.point;
  const corner1 = horizontal ? { x: (a.x + b.x) / 2, y: a.y } : { x: a.x, y: (a.y + b.y) / 2 };
  const corner2 = horizontal ? { x: (a.x + b.x) / 2, y: b.y } : { x: b.x, y: (a.y + b.y) / 2 };
  return {
    path: `M ${at(a)} L ${at(corner1)} L ${at(corner2)} L ${at(b)}`,
    middle: { x: (corner1.x + corner2.x) / 2, y: (corner1.y + corner2.y) / 2 },
    startAngle: Math.atan2(a.y - corner1.y, a.x - corner1.x),
    endAngle: Math.atan2(b.y - corner2.y, b.x - corner2.x),
  };
}

export function connectorGeometry(
  from: ConnectorEnd,
  to: ConnectorEnd,
  style: LineStyle,
): ConnectorGeometry {
  const start = anchor(from, endCenter(to));
  const end = anchor(to, start.point);
  const shape =
    style === 'curved'
      ? curved(start, end)
      : style === 'elbow'
        ? elbow(start, end)
        : {
            path: `M ${at(start.point)} L ${at(end.point)}`,
            middle: {
              x: (start.point.x + end.point.x) / 2,
              y: (start.point.y + end.point.y) / 2,
            },
            startAngle: Math.atan2(start.point.y - end.point.y, start.point.x - end.point.x),
            endAngle: Math.atan2(end.point.y - start.point.y, end.point.x - start.point.x),
          };
  return { ...shape, start: start.point, end: end.point };
}

/** Треугольник наконечника в точке tip, смотрящий по angle. */
export function arrowHead(tip: Point, angle: number, size: number): string {
  const spread = Math.PI / 7;
  const left = {
    x: tip.x - size * Math.cos(angle - spread),
    y: tip.y - size * Math.sin(angle - spread),
  };
  const right = {
    x: tip.x - size * Math.cos(angle + spread),
    y: tip.y - size * Math.sin(angle + spread),
  };
  return `M ${at(tip)} L ${at(left)} L ${at(right)} Z`;
}
