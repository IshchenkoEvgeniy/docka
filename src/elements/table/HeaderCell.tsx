import { useState } from 'react';
import { CONTROL_ATTRIBUTE } from '../../canvas';
import { t } from '../../i18n';
import { newLocalId } from '../localId';
import { CELL_KINDS, optionsOf, type CellKind, type Column, type TableData } from './model';
import styles from './Table.module.css';

const control = { [CONTROL_ATTRIBUTE]: '' };

type Update = (changes: Readonly<Record<string, unknown>>) => void;

/** Следующая сортировка по щелчку на заголовке: по возрастанию → по убыванию → без сортировки. */
export function nextSort(sort: TableData['sort'], columnId: string): TableData['sort'] {
  if (sort?.column !== columnId) return { column: columnId, descending: false };
  return sort.descending ? null : { column: columnId, descending: true };
}

/** Правка вариантов списком через запятую: новые — добавляются, пропавшие — убираются. */
export function optionChanges(column: Column, text: string): Record<string, unknown> {
  const names = [
    ...new Set(
      text
        .split(',')
        .map((name) => name.trim())
        .filter(Boolean),
    ),
  ];
  const existing = optionsOf(column);
  const changes: Record<string, unknown> = {};
  for (const option of existing)
    if (!names.includes(option.name)) changes[option.id] = { removed: true };
  const top = Math.max(0, ...existing.map((option) => option.order));
  names
    .filter((name) => !existing.some((option) => option.name === name))
    .forEach((name, index) => {
      changes[newLocalId()] = { name, order: top + index + 1 };
    });
  return changes;
}

function LazyField({
  value,
  label,
  onCommit,
}: {
  readonly value: string;
  readonly label: string;
  readonly onCommit: (value: string) => void;
}) {
  const [text, setText] = useState(value);
  return (
    <input
      {...control}
      className={styles.input}
      aria-label={label}
      placeholder={label}
      value={text}
      onChange={(event) => {
        setText(event.target.value);
      }}
      onBlur={() => {
        if (text !== value) onCommit(text);
      }}
      onKeyDown={(event) => {
        if (event.key === 'Enter') event.currentTarget.blur();
      }}
    />
  );
}

/** Заголовок в режиме правки: название, вид ячеек, варианты списка, удаление столбца. */
function ColumnSettings({ column, update }: { readonly column: Column; readonly update: Update }) {
  const patch = (changes: Record<string, unknown>) => {
    update({ columns: { [column.id]: changes } });
  };
  return (
    <div className={styles.columnSettings}>
      <LazyField
        value={column.name}
        label={t('elements.table.columnName')}
        onCommit={(name) => {
          patch({ name });
        }}
      />
      <select
        {...control}
        className={styles.input}
        aria-label={t('elements.table.kind')}
        value={column.kind}
        onChange={(event) => {
          const kind: CellKind = CELL_KINDS.find((item) => item === event.target.value) ?? 'text';
          patch({
            kind,
            ...(kind === 'select' && column.options === undefined ? { options: {} } : {}),
          });
        }}
      >
        {CELL_KINDS.map((kind) => (
          <option key={kind} value={kind}>
            {t(`elements.table.kinds.${kind}`)}
          </option>
        ))}
      </select>
      {column.kind === 'select' && (
        <LazyField
          value={optionsOf(column)
            .map((option) => option.name)
            .join(', ')}
          label={t('elements.table.options')}
          onCommit={(text) => {
            patch({ options: optionChanges(column, text) });
          }}
        />
      )}
      <button
        {...control}
        type="button"
        className={styles.remove}
        aria-label={t('elements.table.removeColumn')}
        onClick={() => {
          patch({ removed: true });
        }}
      >
        {t('elements.table.removeIcon')}
      </button>
    </div>
  );
}

export function HeaderCell({
  column,
  data,
  editing,
  update,
}: {
  readonly column: Column;
  readonly data: TableData;
  readonly editing: boolean;
  readonly update: Update;
}) {
  if (editing)
    return (
      <th>
        <ColumnSettings column={column} update={update} />
      </th>
    );
  const sort = data.sort ?? null;
  const arrow = sort?.column !== column.id ? '' : sort.descending ? ' ↓' : ' ↑';
  return (
    <th aria-sort={arrow === '' ? 'none' : sort?.descending === true ? 'descending' : 'ascending'}>
      <button
        {...control}
        type="button"
        className={styles.sort}
        title={t('elements.table.sort')}
        onClick={() => {
          update({ sort: nextSort(sort, column.id) });
        }}
      >
        {`${column.name === '' ? t('elements.table.untitled') : column.name}${arrow}`}
      </button>
    </th>
  );
}
