import type { TranslationKey } from '../../i18n';
import { matchesCombo, parseCombo, type Combo, type KeyLike } from './combo';

/** Одна горячая клавиша. Все определяются списком в одном месте и показываются в настройках. */
export interface HotkeyDefinition {
  readonly id: string;
  /** Например, ['Mod+Shift+KeyZ', 'Mod+KeyY']. */
  readonly combos: readonly string[];
  readonly label: TranslationKey;
  readonly group: TranslationKey;
  /**
   * Обрабатывает не список, а браузер (копирование и вставка — события copy/paste):
   * в списке показывается, но нажатие не перехватывается.
   */
  readonly native?: boolean;
}

export interface ParsedHotkey {
  readonly definition: HotkeyDefinition;
  readonly combos: readonly Combo[];
}

export function parseHotkeys(definitions: readonly HotkeyDefinition[]): readonly ParsedHotkey[] {
  const seen = new Map<string, string>();
  return definitions.map((definition) => {
    for (const combo of definition.combos) {
      const owner = seen.get(combo);
      if (owner !== undefined)
        throw new Error(`Сочетание ${combo} занято: ${owner} и ${definition.id}`);
      seen.set(combo, definition.id);
    }
    return { definition, combos: definition.combos.map(parseCombo) };
  });
}

/** id горячей клавиши для нажатия или null. */
export function findHotkey(
  hotkeys: readonly ParsedHotkey[],
  event: KeyLike,
  isMac: boolean,
): string | null {
  for (const { definition, combos } of hotkeys) {
    if (definition.native === true) continue;
    if (combos.some((combo) => matchesCombo(event, combo, isMac))) return definition.id;
  }
  return null;
}
