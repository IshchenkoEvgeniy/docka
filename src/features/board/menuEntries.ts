import type { AlignMode, DistributeAxis, Point, PointerTarget } from '../../canvas';
import { t, type TranslationKey } from '../../i18n';
import type { MenuEntry } from '../../ui';
import { formatCombo, isMacPlatform, parseCombo } from '../hotkeys';
import {
  alignSelection,
  copySelection,
  createNote,
  deleteSelection,
  distributeSelection,
  duplicateSelection,
  reorderSelection,
  selectAll,
  selectedElements,
  toggleLockSelection,
} from './boardActions';
import { BOARD_HOTKEYS } from './boardHotkeys';
import { appClipboard } from './clipboard';
import type { BoardModel } from './model';
import { connectionMenuEntries } from './connectionMenu';
import { elementTypeEntries } from './elementMenu';
import { pasteFromApp } from './pasting';

export interface MenuContext {
  readonly model: BoardModel;
  readonly target: PointerTarget;
  /** Точка мира, где открыто меню (туда вставляется и создаётся). */
  readonly at: Point;
  readonly fitAll: () => void;
}

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

const separator = (id: string): MenuEntry => ({ kind: 'separator', id });
const heading = (id: string, label: TranslationKey): MenuEntry => ({
  kind: 'heading',
  id,
  label: t(label),
});

const ALIGN: readonly (readonly [AlignMode, TranslationKey])[] = [
  ['left', 'board.menu.alignLeft'],
  ['centerX', 'board.menu.alignCenterX'],
  ['right', 'board.menu.alignRight'],
  ['top', 'board.menu.alignTop'],
  ['centerY', 'board.menu.alignCenterY'],
  ['bottom', 'board.menu.alignBottom'],
];

const DISTRIBUTE: readonly (readonly [DistributeAxis, TranslationKey])[] = [
  ['horizontal', 'board.menu.distributeH'],
  ['vertical', 'board.menu.distributeV'],
];

function arrangeEntries(model: BoardModel, count: number): MenuEntry[] {
  return [
    heading('align', 'board.menu.align'),
    ...ALIGN.map(([mode, label]) =>
      action(
        `align-${mode}`,
        label,
        () => {
          alignSelection(model, mode);
        },
        { disabled: count < 2 },
      ),
    ),
    ...DISTRIBUTE.map(([axis, label]) =>
      action(
        `distribute-${axis}`,
        label,
        () => {
          distributeSelection(model, axis);
        },
        { disabled: count < 3 },
      ),
    ),
  ];
}

function clipboardEntries(model: BoardModel, at: Point): MenuEntry[] {
  const copy = (): void => {
    appClipboard.setState({ content: copySelection(model) });
  };
  const cut = (): void => {
    copy();
    deleteSelection(model);
  };
  const paste = (): void => {
    void pasteFromApp(model, at);
  };
  return [
    action('copy', 'board.menu.copy', copy, { hotkey: 'copy' }),
    action('cut', 'board.menu.cut', cut, { hotkey: 'cut' }),
    action('paste', 'board.menu.paste', paste, { hotkey: 'paste' }),
  ];
}

function elementEntries({ model, at }: MenuContext): MenuEntry[] {
  const selected = selectedElements(model);
  const allLocked = selected.every((element) => element.locked);
  const run = (fn: (target: BoardModel) => void) => () => {
    fn(model);
  };
  const openColor = (): void => {
    model.overlay.setState({ dialog: { kind: 'elementColor' } });
  };
  const [only] = selected;
  return [
    ...(only !== undefined && selected.length === 1 ? elementTypeEntries(model, only) : []),
    ...clipboardEntries(model, at),
    action('duplicate', 'board.menu.duplicate', run(duplicateSelection), { hotkey: 'duplicate' }),
    separator('s1'),
    action(
      'front',
      'board.menu.front',
      run((target) => {
        reorderSelection(target, 'front');
      }),
      { hotkey: 'front' },
    ),
    action(
      'back',
      'board.menu.back',
      run((target) => {
        reorderSelection(target, 'back');
      }),
      { hotkey: 'back' },
    ),
    action('color', 'board.menu.color', openColor),
    action('lock', allLocked ? 'board.menu.unlock' : 'board.menu.lock', run(toggleLockSelection), {
      hotkey: 'lock',
    }),
    separator('s2'),
    // Выравнивать имеет смысл только несколько элементов.
    ...(selected.length < 2 ? [] : [...arrangeEntries(model, selected.length), separator('s3')]),
    action('delete', 'board.menu.delete', run(deleteSelection), { danger: true, hotkey: 'delete' }),
  ];
}

function backgroundEntries({ model, at, fitAll }: MenuContext): MenuEntry[] {
  return [
    action(
      'addNote',
      'board.menu.addNote',
      () => {
        createNote(model, at);
      },
      { hotkey: 'addNote' },
    ),
    action(
      'paste',
      'board.menu.paste',
      () => {
        void pasteFromApp(model, at);
      },
      { hotkey: 'paste' },
    ),
    separator('s1'),
    action(
      'selectAll',
      'board.menu.selectAll',
      () => {
        selectAll(model);
      },
      { hotkey: 'selectAll' },
    ),
    action('fitAll', 'board.menu.fitAll', fitAll, { hotkey: 'fitAll' }),
    action('background', 'board.menu.background', () => {
      model.overlay.setState({ dialog: { kind: 'background' } });
    }),
  ];
}

export function boardMenuEntries(context: MenuContext): MenuEntry[] {
  const { target, model } = context;
  if (target.kind === 'connection') {
    const connection = model.connections.getSnapshot().get(target.id);
    return connection === undefined ? [] : connectionMenuEntries(model, connection);
  }
  return target.kind === 'background' ? backgroundEntries(context) : elementEntries(context);
}
