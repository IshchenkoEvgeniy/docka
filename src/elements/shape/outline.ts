/**
 * Контуры фигур блок-схем в координатах элемента (ширина × высота). Стрелки крепятся к серединам
 * сторон рамки элемента — у прямоугольника, эллипса, ромба и цилиндра это точки самой фигуры.
 */
export const SHAPES = [
  'rectangle',
  'rounded',
  'ellipse',
  'diamond',
  'cylinder',
  'parallelogram',
] as const;
export type Shape = (typeof SHAPES)[number];

const n = (value: number) => String(Math.round(value * 10) / 10);

/** Отступ от рамки, чтобы обводка не обрезалась. */
const INSET = 1;

export function shapePath(shape: Shape, width: number, height: number): string {
  const l = INSET;
  const t = INSET;
  const r = width - INSET;
  const b = height - INSET;
  const cx = width / 2;
  const cy = height / 2;
  switch (shape) {
    case 'rectangle':
      return `M${n(l)} ${n(t)}H${n(r)}V${n(b)}H${n(l)}Z`;
    case 'rounded': {
      const k = Math.min(16, width / 4, height / 4);
      return `M${n(l + k)} ${n(t)}H${n(r - k)}Q${n(r)} ${n(t)} ${n(r)} ${n(t + k)}V${n(b - k)}Q${n(r)} ${n(b)} ${n(r - k)} ${n(b)}H${n(l + k)}Q${n(l)} ${n(b)} ${n(l)} ${n(b - k)}V${n(t + k)}Q${n(l)} ${n(t)} ${n(l + k)} ${n(t)}Z`;
    }
    case 'ellipse':
      return `M${n(l)} ${n(cy)}A${n(cx - l)} ${n(cy - t)} 0 1 0 ${n(r)} ${n(cy)}A${n(cx - l)} ${n(cy - t)} 0 1 0 ${n(l)} ${n(cy)}Z`;
    case 'diamond':
      return `M${n(cx)} ${n(t)}L${n(r)} ${n(cy)}L${n(cx)} ${n(b)}L${n(l)} ${n(cy)}Z`;
    case 'cylinder': {
      const ry = Math.min(height / 6, 18);
      return `M${n(l)} ${n(t + ry)}A${n(cx - l)} ${n(ry)} 0 0 1 ${n(r)} ${n(t + ry)}V${n(b - ry)}A${n(cx - l)} ${n(ry)} 0 0 1 ${n(l)} ${n(b - ry)}Z M${n(l)} ${n(t + ry)}A${n(cx - l)} ${n(ry)} 0 0 0 ${n(r)} ${n(t + ry)}`;
    }
    case 'parallelogram': {
      const skew = Math.min(width / 5, height / 2);
      return `M${n(l + skew)} ${n(t)}H${n(r)}L${n(r - skew)} ${n(b)}H${n(l)}Z`;
    }
  }
}

/** Поля для текста внутри фигуры: у ромба и эллипса углы рамки пустые. */
export function textInset(shape: Shape): string {
  if (shape === 'diamond') return '22% 20%';
  if (shape === 'ellipse') return '14% 12%';
  if (shape === 'cylinder') return '28px 10px 12px';
  if (shape === 'parallelogram') return '8px 18%';
  return '8px 12px';
}
