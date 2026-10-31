import type { LineStyle } from '../../canvas';
import type { Connection } from '../../core';
import { t, type TranslationKey } from '../../i18n';
import type { MenuEntry } from '../../ui';
import { deleteSelection, updateConnection } from './boardActions';
import type { BoardModel } from './model';

const STYLES: readonly (readonly [LineStyle, TranslationKey])[] = [
  ['curved', 'board.connection.curved'],
  ['straight', 'board.connection.straight'],
  ['elbow', 'board.connection.elbow'],
];

export const mark = (on: boolean, label: string) => `${on ? '✓ ' : '   '}${label}`;

/** Меню стрелки: вид линии, наконечники, подпись, цвет, удаление. */
export function connectionMenuEntries(model: BoardModel, connection: Connection): MenuEntry[] {
  const update = (changes: Parameters<typeof updateConnection>[2]) => () => {
    updateConnection(model, connection.id, changes);
  };
  const dialog = (kind: 'label' | 'connectionColor') => () => {
    model.overlay.setState({ dialog: { kind, connectionId: connection.id } });
  };
  return [
    { kind: 'heading', id: 'style', label: t('board.connection.style') },
    ...STYLES.map(([style, label]): MenuEntry => ({
      kind: 'action',
      id: `style-${style}`,
      label: mark(connection.lineStyle === style, t(label)),
      onSelect: update({ lineStyle: style }),
    })),
    { kind: 'separator', id: 's1' },
    {
      kind: 'action',
      id: 'start',
      label: mark(connection.startMarker === 'arrow', t('board.connection.startArrow')),
      onSelect: update({ startMarker: connection.startMarker === 'arrow' ? 'none' : 'arrow' }),
    },
    {
      kind: 'action',
      id: 'end',
      label: mark(connection.endMarker === 'arrow', t('board.connection.endArrow')),
      onSelect: update({ endMarker: connection.endMarker === 'arrow' ? 'none' : 'arrow' }),
    },
    { kind: 'action', id: 'label', label: t('board.connection.label'), onSelect: dialog('label') },
    {
      kind: 'action',
      id: 'color',
      label: t('board.menu.color'),
      onSelect: dialog('connectionColor'),
    },
    { kind: 'separator', id: 's2' },
    {
      kind: 'action',
      id: 'delete',
      label: t('board.menu.delete'),
      danger: true,
      onSelect: () => {
        deleteSelection(model);
      },
    },
  ];
}
