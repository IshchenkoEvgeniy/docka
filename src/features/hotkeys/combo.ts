/**
 * Сочетания клавиш записываются по физическим клавишам (KeyboardEvent.code): Ctrl+A работает
 * и в русской раскладке. Mod — Ctrl, а на macOS — Cmd.
 */

export interface Combo {
  readonly code: string;
  readonly mod: boolean;
  readonly shift: boolean;
  readonly alt: boolean;
}

export interface KeyLike {
  readonly code: string;
  readonly ctrlKey: boolean;
  readonly metaKey: boolean;
  readonly shiftKey: boolean;
  readonly altKey: boolean;
}

/** 'Mod+Shift+KeyZ' → сочетание. */
export function parseCombo(text: string): Combo {
  const parts = text.split('+');
  const code = parts.at(-1) ?? '';
  const modifiers = new Set(parts.slice(0, -1));
  return {
    code,
    mod: modifiers.has('Mod'),
    shift: modifiers.has('Shift'),
    alt: modifiers.has('Alt'),
  };
}

export function matchesCombo(event: KeyLike, combo: Combo, isMac: boolean): boolean {
  const mod = isMac ? event.metaKey : event.ctrlKey;
  return (
    event.code === combo.code &&
    mod === combo.mod &&
    event.shiftKey === combo.shift &&
    event.altKey === combo.alt
  );
}

const KEY_LABELS: Readonly<Record<string, string>> = {
  Escape: 'Esc',
  Delete: 'Del',
  Backspace: '⌫',
  ArrowUp: '↑',
  ArrowDown: '↓',
  ArrowLeft: '←',
  ArrowRight: '→',
  BracketLeft: '[',
  BracketRight: ']',
  Equal: '=',
  Minus: '−',
  Slash: '/',
  Quote: "'",
  Space: '␣',
  Enter: '↵',
};

function keyLabel(code: string): string {
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  return KEY_LABELS[code] ?? code;
}

/** Подпись для списка горячих клавиш: «Ctrl+Shift+Z» или «⌘⇧Z». */
export function formatCombo(combo: Combo, isMac: boolean): string {
  const key = keyLabel(combo.code);
  if (isMac) {
    return `${combo.alt ? '⌥' : ''}${combo.shift ? '⇧' : ''}${combo.mod ? '⌘' : ''}${key}`;
  }
  return [combo.mod && 'Ctrl', combo.alt && 'Alt', combo.shift && 'Shift', key]
    .filter((part): part is string => typeof part === 'string')
    .join('+');
}

export function isMacPlatform(): boolean {
  return typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.userAgent);
}
