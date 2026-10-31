import { describe, expect, it } from 'vitest';
import type { BoardElement } from '../../core';
import { definitionFor } from '../registry';
import { isDark, normalizeHex, rgbText } from './color';
import { SwatchDataSchema } from './schema';

describe('образец цвета', () => {
  it('код приводится к #RRGGBB, мусор отклоняется', () => {
    expect(normalizeHex('abc')).toBe('#AABBCC');
    expect(normalizeHex(' #4a90d9 ')).toBe('#4A90D9');
    expect(normalizeHex('#12345')).toBeNull();
    expect(SwatchDataSchema.safeParse({ hex: '#4A90D9' }).success).toBe(true);
    expect(SwatchDataSchema.safeParse({ hex: 'red' }).success).toBe(false);
  });

  it('RGB, яркость и простой текст', () => {
    expect(rgbText('#4A90D9')).toBe('rgb(74, 144, 217)');
    expect(isDark('#1D1D1B')).toBe(true);
    expect(isDark('#FFF4C2')).toBe(false);
    const element = {
      type: 'swatch',
      data: { hex: '#4A90D9', name: 'Синий' },
    } as unknown as BoardElement; // нужны только эти поля
    expect(definitionFor('swatch').toPlainText(element, null)).toBe(
      'Синий #4A90D9 rgb(74, 144, 217)',
    );
  });
});
