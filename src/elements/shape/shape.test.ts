import { describe, expect, it } from 'vitest';
import type { BoardElement } from '../../core';
import { definitionFor } from '../registry';
import { SHAPES, shapePath } from './outline';

describe('фигуры', () => {
  it('контур есть у каждой фигуры и не выходит за рамку', () => {
    for (const kind of SHAPES) {
      const path = shapePath(kind, 180, 100);
      const numbers = (path.match(/-?\d+(\.\d+)?/g) ?? []).map(Number);
      expect(path.startsWith('M')).toBe(true);
      expect(Math.min(...numbers)).toBeGreaterThanOrEqual(0);
      expect(Math.max(...numbers)).toBeLessThanOrEqual(180);
    }
  });

  it('ромб касается середин сторон — туда крепятся стрелки', () => {
    expect(shapePath('diamond', 200, 100)).toBe('M100 1L199 50L100 99L1 50Z');
  });

  it('вид меняется пунктом меню, текст — для буфера обмена', () => {
    const element = { type: 'shape', data: { shape: 'diamond' } } as unknown as BoardElement; // нужны только эти поля
    const shape = definitionFor('shape');
    expect(shape.menuActions(element).find((action) => action.checked)?.changes).toEqual({
      shape: 'diamond',
    });
    expect(
      shape.toPlainText(element, [
        { type: 'element', name: 'paragraph', children: [{ type: 'text', text: 'Есть ключ?' }] },
      ]),
    ).toBe('Есть ключ?');
  });
});
