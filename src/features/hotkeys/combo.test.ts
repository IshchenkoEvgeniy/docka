import { describe, expect, it } from 'vitest';
import { formatCombo, matchesCombo, parseCombo } from './combo';
import { findHotkey, parseHotkeys } from './registry';

const key = (
  code: string,
  modifiers: Partial<Record<'ctrl' | 'meta' | 'shift' | 'alt', boolean>> = {},
) => ({
  code,
  ctrlKey: modifiers.ctrl ?? false,
  metaKey: modifiers.meta ?? false,
  shiftKey: modifiers.shift ?? false,
  altKey: modifiers.alt ?? false,
});

describe('сочетания клавиш', () => {
  it('Mod — Ctrl, а на Mac — Cmd; модификаторы совпадают точно', () => {
    const undo = parseCombo('Mod+KeyZ');
    expect(matchesCombo(key('KeyZ', { ctrl: true }), undo, false)).toBe(true);
    expect(matchesCombo(key('KeyZ', { meta: true }), undo, true)).toBe(true);
    expect(matchesCombo(key('KeyZ', { ctrl: true, shift: true }), undo, false)).toBe(false);
  });

  it('подписи', () => {
    expect(formatCombo(parseCombo('Mod+Shift+KeyZ'), false)).toBe('Ctrl+Shift+Z');
    expect(formatCombo(parseCombo('Mod+Shift+KeyZ'), true)).toBe('⇧⌘Z');
    expect(formatCombo(parseCombo('Shift+Digit1'), false)).toBe('Shift+1');
  });

  it('список: поиск по нажатию, конфликт сочетаний — ошибка, «родные» не перехватываются', () => {
    const label = 'app.title' as const;
    const list = parseHotkeys([
      { id: 'undo', combos: ['Mod+KeyZ'], label, group: label },
      { id: 'copy', combos: ['Mod+KeyC'], label, group: label, native: true },
    ]);
    expect(findHotkey(list, key('KeyZ', { ctrl: true }), false)).toBe('undo');
    expect(findHotkey(list, key('KeyC', { ctrl: true }), false)).toBeNull();
    expect(() =>
      parseHotkeys([
        { id: 'a', combos: ['KeyN'], label, group: label },
        { id: 'b', combos: ['KeyN'], label, group: label },
      ]),
    ).toThrow(/KeyN/);
  });
});
