import { describe, expect, it } from 'vitest';
import { align, distribute } from './arrange';

const item = (id: string, x: number, y: number, width = 100, height = 50) => ({
  id,
  rect: { x, y, width, height },
});

describe('выравнивание и распределение', () => {
  const items = [item('a', 0, 0), item('b', 40, 100, 200), item('c', 10, 300, 50)];

  it('по левому краю и по правому', () => {
    expect(align(items, 'left')).toEqual([
      { id: 'b', x: 0, y: 100 },
      { id: 'c', x: 0, y: 300 },
    ]);
    expect(align(items, 'right').map((move) => move.x)).toEqual([140, 190]); // b уже у правого края
  });

  it('по центру по вертикали', () => {
    expect(align(items, 'centerY').map((move) => move.y)).toEqual([150, 150, 150]);
  });

  it('один элемент не выравнивается', () => {
    expect(align([item('a', 0, 0)], 'left')).toEqual([]);
  });

  it('равные промежутки, крайние на месте', () => {
    const row = [item('a', 0, 0), item('c', 900, 0), item('b', 150, 0)];
    expect(distribute(row, 'horizontal')).toEqual([{ id: 'b', x: 450, y: 0 }]);
    expect(distribute(row.slice(0, 2), 'horizontal')).toEqual([]);
  });
});
