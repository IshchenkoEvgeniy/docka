import { describe, expect, it } from 'vitest';
import type { BoardElement } from '../core';
import { definitionFor, elementTypes, isKnownType } from './registry';

const element = (type: string, data: Record<string, unknown>) =>
  ({ type, data, color: 'default' }) as unknown as BoardElement; // для toPlainText нужны только эти поля

describe('реестр элементов', () => {
  it('знает заметку и отдаёт её текст', () => {
    expect(elementTypes).toContain('note');
    const note = definitionFor('note');
    expect(note.createData()).toEqual({});
    expect(note.toPlainText(element('note', { text: 'Таверна' }), null)).toBe('Таверна');
    expect(
      note.toPlainText(element('note', {}), [
        { type: 'element', name: 'paragraph', children: [{ type: 'text', text: 'Кузнец' }] },
      ]),
    ).toBe('Кузнец');
    expect(definitionFor('title').richText).toBe(true);
  });

  it('битые данные и неизвестный тип не роняют', () => {
    expect(definitionFor('note').toPlainText(element('note', { text: 5 }), null)).toBe('');
    expect(isKnownType('hologram')).toBe(false);
    expect(definitionFor('hologram').resize).toBe('both');
  });
});
