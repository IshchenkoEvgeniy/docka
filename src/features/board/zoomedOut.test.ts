import { describe, expect, it } from 'vitest';
import { AUTO_OUTLINE_ELEMENTS, simplifiesZoomedOut } from './ElementLayer';

describe('карточки при отдалении', () => {
  it('«Содержимое» никогда не упрощает, «Контуры» — всегда', () => {
    expect(simplifiesZoomedOut('content', 5000)).toBe(false);
    expect(simplifiesZoomedOut('outline', 1)).toBe(true);
  });

  it('«Авто» упрощает только большие доски', () => {
    expect(simplifiesZoomedOut('auto', AUTO_OUTLINE_ELEMENTS)).toBe(false);
    expect(simplifiesZoomedOut('auto', AUTO_OUTLINE_ELEMENTS + 1)).toBe(true);
  });
});
