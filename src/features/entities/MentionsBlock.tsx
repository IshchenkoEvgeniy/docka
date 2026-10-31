import { useEffect, useState } from 'react';
import type { BoardId } from '../../core';
import type { OpenProject } from '../../data';
import { EntityChips } from '../../elements';
import { t } from '../../i18n';
import { Button } from '../../ui';
import { findEntityUsage, type EntityUsage } from './usage';
import styles from './Entities.module.css';

type State =
  | { readonly status: 'loading' }
  | { readonly status: 'ready'; readonly usage: EntityUsage }
  | { readonly status: 'error' };

/** Какие ссылки на доску считать: карточки сущности и упоминания в тексте. */
function useUsage(project: OpenProject, entityId: string): State {
  const [state, setState] = useState<State>({ status: 'loading' });
  useEffect(() => {
    let cancelled = false;
    setState({ status: 'loading' });
    findEntityUsage(project, entityId).then(
      (usage) => {
        if (!cancelled) setState({ status: 'ready', usage });
      },
      (error: unknown) => {
        console.error('Не удалось найти упоминания сущности', error);
        if (!cancelled) setState({ status: 'error' });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [project, entityId]);
  return state;
}

/** Блок «Упоминания»: доски, где лежит сущность, и тексты, где о ней написано (ТЗ, раздел 6). */
export function MentionsBlock({
  project,
  entityId,
  onOpenBoard,
}: {
  readonly project: OpenProject;
  readonly entityId: string;
  readonly onOpenBoard: (boardId: BoardId) => void;
}) {
  const state = useUsage(project, entityId);
  if (state.status === 'loading')
    return <p className={styles.muted}>{t('entities.usage.loading')}</p>;
  if (state.status === 'error') return <p className={styles.muted}>{t('entities.usage.failed')}</p>;
  const { boards, mentionedIn } = state.usage;
  if (boards.length === 0 && mentionedIn.length === 0)
    return <p className={styles.muted}>{t('entities.usage.none')}</p>;
  return (
    <div className={styles.usage}>
      {boards.map((board) => (
        <Button
          key={board.boardId}
          variant="ghost"
          className={styles.usageRow}
          onClick={() => {
            onOpenBoard(board.boardId);
          }}
        >
          <span>{board.title}</span>
          <span className={styles.muted}>
            {[
              board.placements > 0
                ? t('entities.usage.placements', { count: board.placements })
                : '',
              board.mentions > 0 ? t('entities.usage.mentions', { count: board.mentions }) : '',
            ]
              .filter((part) => part !== '')
              .join(' · ')}
          </span>
        </Button>
      ))}
      {mentionedIn.length > 0 && (
        <div className={styles.fieldRow}>
          <span className={styles.fieldLabel}>{t('entities.usage.inEntities')}</span>
          <EntityChips ids={mentionedIn} />
        </div>
      )}
    </div>
  );
}
