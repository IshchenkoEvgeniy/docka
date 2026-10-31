import type { DragEvent } from 'react';
import { fieldsOf, type Entity, type EntityType } from '../../core';
import { EntityCard, FieldValue, entityName, fieldName, typeName } from '../../elements';
import { t } from '../../i18n';
import { Button, cardColor } from '../../ui';
import { PLACE_MIME, entityPayload, serializePayload } from '../board';
import type { LibrarySort } from './librarySort';
import styles from './Entities.module.css';

export interface LibraryActions {
  readonly open: (entityId: string) => void;
  readonly place: (entityId: string) => void;
  readonly remove: (entityId: string) => void;
}

/** Перетаскивание на доску: элемент-ссылка на сущность (кладётся как есть). */
function dragProps(entityId: string) {
  return {
    draggable: true,
    onDragStart: (event: DragEvent) => {
      event.dataTransfer.setData(PLACE_MIME, serializePayload(entityPayload(entityId)));
      event.dataTransfer.effectAllowed = 'copy';
    },
  };
}

function RowActions({
  entity,
  actions,
}: {
  readonly entity: Entity;
  readonly actions: LibraryActions;
}) {
  return (
    <span className={styles.rowActions}>
      <Button
        onClick={() => {
          actions.place(entity.id);
        }}
      >
        {t('entities.library.place')}
      </Button>
      <Button
        variant="ghost"
        className={styles.danger}
        aria-label={t('entities.library.delete', { name: entityName(entity.name) })}
        onClick={() => {
          actions.remove(entity.id);
        }}
      >
        {t('entities.library.deleteIcon')}
      </Button>
    </span>
  );
}

function SortHeader({
  id,
  label,
  sort,
  onSort,
}: {
  readonly id: string;
  readonly label: string;
  readonly sort: LibrarySort;
  readonly onSort: (sort: LibrarySort) => void;
}) {
  const active = sort.key === id;
  return (
    <th aria-sort={active ? (sort.descending ? 'descending' : 'ascending') : 'none'}>
      <button
        type="button"
        className={styles.sortButton}
        onClick={() => {
          onSort({ key: id, descending: active && !sort.descending });
        }}
      >
        {active ? `${label} ${sort.descending ? '↓' : '↑'}` : label}
      </button>
    </th>
  );
}

/** Строка = сущность, столбец = поле (поля — когда выбран один тип). */
export function LibraryTable({
  items,
  types,
  type,
  sort,
  onSort,
  actions,
}: {
  readonly items: readonly Entity[];
  readonly types: ReadonlyMap<string, EntityType>;
  readonly type: EntityType | null;
  readonly sort: LibrarySort;
  readonly onSort: (sort: LibrarySort) => void;
  readonly actions: LibraryActions;
}) {
  const fields = type === null ? [] : fieldsOf(type).filter((field) => field.kind !== 'longText');
  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <thead>
          <tr>
            <SortHeader id="name" label={t('entities.library.name')} sort={sort} onSort={onSort} />
            {type === null && (
              <SortHeader
                id="type"
                label={t('entities.library.type')}
                sort={sort}
                onSort={onSort}
              />
            )}
            {fields.map((field) => (
              <SortHeader
                key={field.id}
                id={field.id}
                label={fieldName(field)}
                sort={sort}
                onSort={onSort}
              />
            ))}
            <th />
          </tr>
        </thead>
        <tbody>
          {items.map((entity) => {
            const entityType = types.get(entity.typeId);
            return (
              <tr key={entity.id} {...dragProps(entity.id)}>
                <td>
                  <button
                    type="button"
                    className={styles.nameButton}
                    onClick={() => {
                      actions.open(entity.id);
                    }}
                  >
                    {`${entityType?.icon ?? ''} ${entityName(entity.name)}`}
                  </button>
                </td>
                {type === null && <td>{entityType === undefined ? '' : typeName(entityType)}</td>}
                {fields.map((field) => (
                  <td key={field.id}>
                    <FieldValue entity={entity} field={field} />
                  </td>
                ))}
                <td>
                  <RowActions entity={entity} actions={actions} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** Плитки — те же карточки, что и на доске. */
export function LibraryTiles({
  items,
  types,
  actions,
}: {
  readonly items: readonly Entity[];
  readonly types: ReadonlyMap<string, EntityType>;
  readonly actions: LibraryActions;
}) {
  return (
    <div className={styles.tiles}>
      {items.map((entity) => {
        const type = types.get(entity.typeId);
        if (type === undefined) return null;
        return (
          <div key={entity.id} className={styles.tile} {...dragProps(entity.id)}>
            {/* Внутри карточки есть свои кнопки (связи), поэтому сама плитка — не <button>. */}
            <div
              role="button"
              tabIndex={0}
              className={styles.tileCard}
              style={{ background: cardColor(type.color) }}
              onClick={() => {
                actions.open(entity.id);
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter') actions.open(entity.id);
              }}
            >
              <EntityCard entity={entity} type={type} />
            </div>
            <RowActions entity={entity} actions={actions} />
          </div>
        );
      })}
    </div>
  );
}
