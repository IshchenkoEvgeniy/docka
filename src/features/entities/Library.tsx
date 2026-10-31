import { useMemo, useState } from 'react';
import type { EntityId } from '../../core';
import { typeName, useEntities, useEntityTypes, useTags } from '../../elements';
import { tagRows } from '../tags';
import { t } from '../../i18n';
import { Button, Segmented } from '../../ui';
import { filterAndSort, type LibrarySort } from './librarySort';
import { LibraryTable, LibraryTiles, type LibraryActions } from './LibraryViews';
import styles from './Entities.module.css';

type LibraryView = 'table' | 'tiles';

export interface LibraryProps {
  readonly onClose: () => void;
  readonly onOpenTypes: () => void;
  /** Новая сущность типа; возвращает id (null — не создана). */
  readonly onCreate: (typeId: string) => EntityId | null;
  readonly actions: LibraryActions;
}

/**
 * Библиотека сущностей проекта (ТЗ, раздел 6): таблицей или плитками, фильтр по типу и
 * названию, сортировка по столбцам. Карточку можно перетащить на доску или нажать «На доску».
 */
export function Library({ onClose, onOpenTypes, onCreate, actions }: LibraryProps) {
  const entities = useEntities();
  const types = useEntityTypes();
  const [typeId, setTypeId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [view, setView] = useState<LibraryView>('table');
  const [sort, setSort] = useState<LibrarySort>({ key: 'name', descending: false });
  const allTags = useTags();
  const [tagName, setTagName] = useState<string | null>(null);
  const type = typeId === null ? null : (types.get(typeId) ?? null);
  const items = useMemo(
    () =>
      filterAndSort(
        entities,
        types,
        {
          typeId: type?.id ?? null,
          query,
          sort,
          tag: tagName === null ? null : { name: tagName, all: allTags },
        },
        typeName,
      ),
    [entities, types, type, query, sort, tagName, allTags],
  );
  const sortedTypes = [...types.values()].sort((a, b) => typeName(a).localeCompare(typeName(b)));
  const createType = type ?? sortedTypes[0];
  return (
    <aside className={styles.library} aria-label={t('entities.library.title')}>
      <header className={styles.panelHeader}>
        <span className={styles.panelTitle}>{t('entities.library.title')}</span>
        <Button variant="ghost" onClick={onOpenTypes}>
          {t('entities.library.types')}
        </Button>
        <Button variant="ghost" onClick={onClose}>
          {t('common.close')}
        </Button>
      </header>
      <div className={styles.libraryBar}>
        <select
          className={styles.input}
          aria-label={t('entities.library.filterType')}
          value={type?.id ?? ''}
          onChange={(event) => {
            setTypeId(event.target.value === '' ? null : event.target.value);
            setSort({ key: 'name', descending: false });
          }}
        >
          <option value="">{t('entities.library.allTypes')}</option>
          {sortedTypes.map((item) => (
            <option key={item.id} value={item.id}>
              {`${item.icon} ${typeName(item)}`}
            </option>
          ))}
        </select>
        <select
          className={styles.input}
          aria-label={t('entities.library.filterTag')}
          value={tagName ?? ''}
          onChange={(event) => {
            setTagName(event.target.value === '' ? null : event.target.value);
          }}
        >
          <option value="">{t('entities.library.allTags')}</option>
          {tagRows(allTags).map(({ name }) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
        <input
          className={styles.input}
          type="search"
          value={query}
          placeholder={t('entities.library.search')}
          aria-label={t('entities.library.search')}
          onChange={(event) => {
            setQuery(event.target.value);
          }}
        />
        <Segmented<LibraryView>
          label={t('entities.library.view')}
          value={view}
          options={[
            { value: 'table', label: t('entities.library.table') },
            { value: 'tiles', label: t('entities.library.tiles') },
          ]}
          onChange={setView}
        />
        <Button
          variant="primary"
          disabled={createType === undefined}
          onClick={() => {
            if (createType === undefined) return;
            const created = onCreate(createType.id);
            if (created !== null) actions.open(created);
          }}
        >
          {createType === undefined
            ? t('entities.library.create')
            : t('entities.library.createOf', { type: typeName(createType) })}
        </Button>
      </div>
      <p className={styles.muted}>{t('entities.library.hint')}</p>
      {items.length === 0 ? (
        <p className={styles.muted}>{t('entities.library.empty')}</p>
      ) : view === 'table' ? (
        <LibraryTable
          items={items}
          types={types}
          type={type}
          sort={sort}
          onSort={setSort}
          actions={actions}
        />
      ) : (
        <LibraryTiles items={items} types={types} actions={actions} />
      )}
    </aside>
  );
}
