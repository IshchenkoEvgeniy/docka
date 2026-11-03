import { t, type TranslationKey } from '../../i18n';
import type { MenuEntry } from '../../ui';
import { formatCombo, isMacPlatform, parseCombo } from '../hotkeys';
import { BOARD_HOTKEYS } from './boardHotkeys';

export function hint(id: string): string | undefined {
  const combo = BOARD_HOTKEYS.find((hotkey) => hotkey.id === id)?.combos[0];
  return combo === undefined ? undefined : formatCombo(parseCombo(combo), isMacPlatform());
}

export function action(
  id: string,
  label: TranslationKey,
  onSelect: () => void,
  options: { disabled?: boolean; danger?: boolean; hotkey?: string } = {},
): MenuEntry {
  const shortcut = options.hotkey === undefined ? undefined : hint(options.hotkey);
  return {
    kind: 'action',
    id,
    label: t(label),
    onSelect,
    ...(shortcut === undefined ? {} : { hint: shortcut }),
    ...(options.disabled === undefined ? {} : { disabled: options.disabled }),
    ...(options.danger === undefined ? {} : { danger: options.danger }),
  };
}
