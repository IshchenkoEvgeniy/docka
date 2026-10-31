import { describe, expect, it } from 'vitest';
import { cx } from './cx';

describe('cx', () => {
  it('склеивает классы и пропускает пустые', () => {
    expect(cx('a', undefined, false, null, '', 'b')).toBe('a b');
  });
});
