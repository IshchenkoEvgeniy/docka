import type { BoardElement } from '../../core';
import { definitionFor } from '../../elements';
import { t } from '../../i18n';
import type { MenuEntry } from '../../ui';
import { openTarget } from './boardActions';
import { mark } from './connectionMenu';
import type { BoardModel } from './model';

/** Пункты меню одного элемента от его типа: «Открыть» и смена вида (карточка сущности). */
export function elementTypeEntries(model: BoardModel, element: BoardElement): MenuEntry[] {
  const definition = definitionFor(element.type);
  const target = definition.target(element);
  const open: MenuEntry[] =
    target === null
      ? []
      : [
          {
            kind: 'action',
            id: 'open',
            label: target.kind === 'board' ? t('board.menu.openBoard') : t('entities.open'),
            onSelect: () => {
              openTarget(model, element);
            },
          },
        ];
  const actions = definition.menuActions(element).map((action): MenuEntry => ({
    kind: 'action',
    id: action.id,
    label: mark(action.checked, action.label),
    onSelect: () => {
      model.run({
        kind: 'updateElement',
        elementId: element.id,
        changes: { data: action.changes },
      });
      model.markForMeasure([element.id]);
    },
  }));
  const entries = [...open, ...actions];
  return entries.length === 0 ? [] : [...entries, { kind: 'separator', id: 'type-end' }];
}
