import { useEffect, useMemo, useState, type KeyboardEvent } from 'react';
import type { Board } from '../../core';
import { definitionFor, typeName, useEntityTypes, useTags } from '../../elements';
import { t } from '../../i18n';
import { cx } from '../../ui';
import { matchCommands, type PaletteCommand } from './commands';
import { PaletteFilters } from './PaletteFilters';
import type { SearchDoc } from './searchDocs';
import { NO_FILTERS, type SearchFilters, type SearchIndex } from './searchIndex';
import styles from './Search.module.css';

export interface SearchPaletteProps {
  readonly index: SearchIndex;
  readonly commands: readonly PaletteCommand[];
  readonly boards: readonly Board[];
  readonly now: number;
  readonly onOpen: (doc: SearchDoc) => void;
  readonly onClose: () => void;
}

type Row =
  | { readonly kind: 'command'; readonly command: PaletteCommand }
  | { readonly kind: 'doc'; readonly doc: SearchDoc };

/** Индекс перечитывается при каждом открытии окна (только изменившиеся доски). */
function useRefreshed(index: SearchIndex): boolean {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let cancelled = false;
    index.refresh().then(
      () => {
        if (!cancelled) setReady(true);
      },
      (error: unknown) => {
        console.error('Индекс поиска не обновлён', error);
        if (!cancelled) setReady(true);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [index]);
  return ready;
}

/** Где лежит найденное: доска элемента, тип сущности. */
function useContextOf(boards: readonly Board[]) {
  const types = useEntityTypes();
  return (doc: SearchDoc): string => {
    if (doc.kind === 'board') return t('search.kind.board');
    if (doc.kind === 'entity') {
      const type = types.get(doc.type);
      return type === undefined ? '' : typeName(type);
    }
    const board = boards.find((item) => item.id === doc.boardId)?.title ?? '';
    return `${definitionFor(doc.type).label()} · ${board}`;
  };
}

/** Ctrl+K: поиск по доскам, элементам и сущностям проекта и команды (ТЗ, раздел 7). */
export function SearchPalette({
  index,
  commands,
  boards,
  now,
  onOpen,
  onClose,
}: SearchPaletteProps) {
  const ready = useRefreshed(index);
  const tags = useTags();
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState<SearchFilters>(NO_FILTERS);
  const [active, setActive] = useState(0);
  const contextOf = useContextOf(boards);
  const rows = useMemo((): Row[] => {
    const found = ready ? index.search(query, filters, tags) : [];
    return [
      ...matchCommands(commands, query).map((command): Row => ({ kind: 'command', command })),
      ...found.map((doc): Row => ({ kind: 'doc', doc })),
    ];
  }, [ready, index, query, filters, tags, commands]);
  const choose = (row: Row | undefined): void => {
    if (row === undefined) return;
    onClose();
    if (row.kind === 'command') row.command.run();
    else onOpen(row.doc);
  };
  const onKeyDown = (event: KeyboardEvent): void => {
    if (event.key === 'ArrowDown') setActive((active + 1) % Math.max(1, rows.length));
    else if (event.key === 'ArrowUp')
      setActive((active - 1 + rows.length) % Math.max(1, rows.length));
    else if (event.key === 'Enter') choose(rows[active]);
    else if (event.key === 'Escape') onClose();
    else return;
    event.preventDefault();
  };
  return (
    <div
      className={styles.backdrop}
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className={styles.palette}
        role="dialog"
        aria-modal="true"
        aria-label={t('search.title')}
      >
        <input
          className={styles.query}
          autoFocus
          value={query}
          placeholder={t('search.placeholder')}
          aria-label={t('search.placeholder')}
          onChange={(event) => {
            setQuery(event.target.value);
            setActive(0);
          }}
          onKeyDown={onKeyDown}
        />
        <PaletteFilters filters={filters} boards={boards} now={now} onChange={setFilters} />
        {!ready && <p className={styles.status}>{t('search.indexing')}</p>}
        {ready && rows.length === 0 && query.trim() !== '' && (
          <p className={styles.status}>{t('search.nothing')}</p>
        )}
        <ul className={styles.results} role="listbox" aria-label={t('search.results')}>
          {rows.map((row, position) => (
            <li key={row.kind === 'command' ? `c:${row.command.id}` : row.doc.id}>
              <button
                type="button"
                role="option"
                aria-selected={position === active}
                className={cx(styles.result, position === active && styles.active)}
                onPointerEnter={() => {
                  setActive(position);
                }}
                onClick={() => {
                  choose(row);
                }}
              >
                <span className={styles.title}>
                  {row.kind === 'command' ? row.command.label : row.doc.title}
                </span>
                <span className={styles.context}>
                  {row.kind === 'command' ? t('search.kind.command') : contextOf(row.doc)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
