import { describe, expect, it } from 'vitest';
import { snapMove, snapToGrid } from './snapping';

const rect = (x: number, y: number, width = 100, height = 50) => ({ x, y, width, height });

describe('прилипание', () => {
  it('прилипает левым краем к соседу и рисует направляющую через оба', () => {
    const result = snapMove(rect(203, 300), [rect(200, 0)], 6, null);
    expect(result.dx).toBe(-3);
    expect(result.dy).toBe(0);
    expect(result.guides).toEqual([{ axis: 'x', position: 200, from: 0, to: 350 }]);
  });

  it('центр к центру и по второй оси одновременно', () => {
    const result = snapMove(rect(52, 98), [rect(0, 0), rect(500, 100)], 6, null);
    expect(result.dx).toBe(-2); // левый край 52 → центр соседа 50
    expect(result.dy).toBe(2); // верх 98 → верх 100
    expect(result.guides).toHaveLength(2);
  });

  it('далеко от соседей — к сетке', () => {
    const result = snapMove(rect(1010, 1013), [rect(0, 0)], 6, 24);
    expect(result).toEqual({ dx: 1008 - 1010, dy: 1008 - 1013, guides: [] });
  });

  it('без сетки и соседей — без поправки', () => {
    expect(snapMove(rect(1010, 1013), [], 6, null)).toEqual({ dx: 0, dy: 0, guides: [] });
    expect(snapToGrid(-13, 24)).toBe(-24);
  });
});
