import { describe, expect, it } from 'vitest';
import { arrowHead, connectorGeometry, facingSide } from './connectors';

const box = (x: number, y: number) => ({ x, y, width: 100, height: 50 });

describe('геометрия стрелок', () => {
  it('сторона крепления смотрит на цель', () => {
    expect(facingSide(box(0, 0), { x: 500, y: 30 })).toBe('right');
    expect(facingSide(box(0, 0), { x: 50, y: -400 })).toBe('top');
    expect(facingSide(box(0, 0), { x: -300, y: 25 })).toBe('left');
  });

  it('прямая между ближними сторонами, середина и угол конца', () => {
    const geometry = connectorGeometry(
      { kind: 'rect', rect: box(0, 0), side: 'auto' },
      { kind: 'rect', rect: box(300, 0), side: 'auto' },
      'straight',
    );
    expect(geometry.start).toEqual({ x: 100, y: 25 });
    expect(geometry.end).toEqual({ x: 300, y: 25 });
    expect(geometry.middle).toEqual({ x: 200, y: 25 });
    expect(geometry.endAngle).toBeCloseTo(0);
    expect(geometry.path).toBe('M 100 25 L 300 25');
  });

  it('плавная выходит по нормали стороны, ломаная — под прямыми углами', () => {
    const curved = connectorGeometry(
      { kind: 'rect', rect: box(0, 0), side: 'bottom' },
      { kind: 'point', point: { x: 50, y: 400 } },
      'curved',
    );
    expect(curved.path.startsWith('M 50 50 C 50 ')).toBe(true);
    const elbow = connectorGeometry(
      { kind: 'rect', rect: box(0, 0), side: 'right' },
      { kind: 'rect', rect: box(300, 200), side: 'left' },
      'elbow',
    );
    expect(elbow.path).toBe('M 100 25 L 200 25 L 200 225 L 300 225');
  });

  it('наконечник — треугольник с вершиной в конце', () => {
    expect(arrowHead({ x: 10, y: 0 }, 0, 10).startsWith('M 10 0 L')).toBe(true);
  });
});
