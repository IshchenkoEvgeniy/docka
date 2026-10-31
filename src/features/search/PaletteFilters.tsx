import type { Board } from '../../core';
import { definitionFor, elementTypes, typeName, useEntityTypes, useTags } from '../../elements';
import { t } from '../../i18n';
import { tagRows } from '../tags';
import type { SearchFilters } from './searchIndex';
import styles from './Search.module.css';

const DAY_MS = 24 * 60 * 60 * 1000;
const PERIODS = [
  ['day', DAY_MS],
  ['week', 7 * DAY_MS],
  ['month', 30 * DAY_MS],
] as const;

interface FiltersProps {
  readonly filters: SearchFilters;
  readonly boards: readonly Board[];
  readonly now: number;
  readonly onChange: (filters: SearchFilters) => void;
}

/** Фильтры поиска: тип, тег, доска, давность изменения, невыполненные задачи. */
export function PaletteFilters({ filters, boards, now, onChange }: FiltersProps) {
  const tags = useTags();
  const types = useEntityTypes();
  const set = (changes: Partial<SearchFilters>) => {
    onChange({ ...filters, ...changes });
  };
  const since =
    filters.since === null ? '' : (PERIODS.find(([, ms]) => now - ms === filters.since)?.[0] ?? '');
  return (
    <div className={styles.filters}>
      <select
        className={styles.select}
        aria-label={t('search.filter.type')}
        value={filters.type ?? ''}
        onChange={(event) => {
          set({ type: event.target.value === '' ? null : event.target.value });
        }}
      >
        <option value="">{t('search.filter.anyType')}</option>
        <option value="board">{t('search.filter.boards')}</option>
        {[...types.values()].map((type) => (
          <option key={type.id} value={type.id}>
            {`${type.icon} ${typeName(type)}`}
          </option>
        ))}
        {elementTypes.map((type) => (
          <option key={type} value={type}>
            {definitionFor(type).label()}
          </option>
        ))}
      </select>
      <select
        className={styles.select}
        aria-label={t('search.filter.tag')}
        value={filters.tag ?? ''}
        onChange={(event) => {
          set({ tag: event.target.value === '' ? null : event.target.value });
        }}
      >
        <option value="">{t('search.filter.anyTag')}</option>
        {tagRows(tags).map(({ name }) => (
          <option key={name} value={name}>
            {name}
          </option>
        ))}
      </select>
      <select
        className={styles.select}
        aria-label={t('search.filter.board')}
        value={filters.boardId ?? ''}
        onChange={(event) => {
          set({ boardId: event.target.value === '' ? null : event.target.value });
        }}
      >
        <option value="">{t('search.filter.anyBoard')}</option>
        {boards.map((board) => (
          <option key={board.id} value={board.id}>
            {board.title}
          </option>
        ))}
      </select>
      <select
        className={styles.select}
        aria-label={t('search.filter.changed')}
        value={since}
        onChange={(event) => {
          const period = PERIODS.find(([key]) => key === event.target.value);
          set({ since: period === undefined ? null : now - period[1] });
        }}
      >
        <option value="">{t('search.filter.anyTime')}</option>
        {PERIODS.map(([key]) => (
          <option key={key} value={key}>
            {t(`search.filter.${key}`)}
          </option>
        ))}
      </select>
      <label className={styles.check}>
        <input
          type="checkbox"
          checked={filters.openTasks}
          onChange={(event) => {
            set({ openTasks: event.target.checked });
          }}
        />
        {t('search.filter.openTasks')}
      </label>
    </div>
  );
}
