import type { Board, BoardId } from '../../core';
import { t } from '../../i18n';
import styles from './Project.module.css';

interface BreadcrumbsProps {
  /** Путь от корня до текущей доски. */
  readonly path: readonly Board[];
  readonly onOpen: (boardId: BoardId) => void;
  /** Нажатие на текущую доску — переименование. */
  readonly onRename: () => void;
}

/** «Проект / Доска / Поддоска»: всё, кроме последней, — переход наверх. */
export function Breadcrumbs({ path, onOpen, onRename }: BreadcrumbsProps) {
  return (
    <ol className={styles.crumbs} aria-label={t('project.crumbs')}>
      {path.map((board, index) => {
        const last = index === path.length - 1;
        return (
          <li key={board.id} className={styles.crumb}>
            {index > 0 && <span className={styles.crumbSeparator}>{'/'}</span>}
            <button
              type="button"
              className={last ? styles.crumbCurrent : styles.crumbLink}
              title={last ? t('project.rename') : undefined}
              onClick={() => {
                if (last) onRename();
                else onOpen(board.id);
              }}
            >
              {board.title}
            </button>
          </li>
        );
      })}
    </ol>
  );
}
