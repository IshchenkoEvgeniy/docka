import type { Tag } from '../../core';
import { t } from '../../i18n';
import type { MenuEntry } from '../../ui';
import { tagRows } from '../tags';
import { mark } from './connectionMenu';
import type { BoardModel } from './model';

/** Меню фильтра «Теги»: подсветить элементы с тегом (и вложенными), остальные приглушить. */
export function tagFilterEntries(model: BoardModel, tags: ReadonlyMap<string, Tag>): MenuEntry[] {
  const current = model.settings.getState().tagFilter;
  const choose = (tagFilter: string | null) => () => {
    model.settings.setState({ tagFilter });
  };
  const rows = tagRows(tags).map(({ name, depth, leaf }): MenuEntry => ({
    kind: 'action',
    id: `tag-${name}`,
    label: mark(current === name, `${'  '.repeat(depth)}${leaf}`),
    onSelect: choose(name),
  }));
  return [
    { kind: 'heading', id: 'filter', label: t('board.tags.filter') },
    {
      kind: 'action',
      id: 'tag-none',
      label: mark(current === null, t('board.tags.none')),
      onSelect: choose(null),
    },
    ...rows,
    { kind: 'separator', id: 'manage-sep' },
    {
      kind: 'action',
      id: 'manage',
      label: t('board.tags.manage'),
      disabled: model.host.tags === null,
      onSelect: model.host.openTagManager,
    },
  ];
}
