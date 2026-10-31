import { describe, expect, it } from 'vitest';
import { nextMounted } from './progressiveMount';

describe('постепенный монтаж', () => {
  it('добавляет порциями в порядке списка и удаляет ушедшие сразу', () => {
    const wanted = ['a', 'b', 'c', 'd', 'e'];
    const first = nextMounted(new Set(), wanted, 2);
    expect([...first.mounted]).toEqual(['a', 'b']);
    expect(first.pending).toBe(true);
    const second = nextMounted(first.mounted, ['b', 'c', 'd', 'e'], 2);
    expect([...second.mounted].sort()).toEqual(['b', 'c', 'd']);
    const third = nextMounted(second.mounted, ['b', 'c', 'd', 'e'], 2);
    expect(third.pending).toBe(false);
    expect(nextMounted(third.mounted, ['b', 'c', 'd', 'e'], 2).mounted).toBe(third.mounted);
  });
});
