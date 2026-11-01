import { useState } from 'react';
import { z } from 'zod';
import { CONTROL_ATTRIBUTE } from '../../canvas';
import { BoardIdSchema } from '../../core';
import { t } from '../../i18n';
import { Icon, cardColor, inkColor } from '../../ui';
import { defineElement } from '../defineElement';
import { useElementRuntime } from '../runtime';
import type { ElementViewProps } from '../types';
import styles from './BoardLink.module.css';
import { useLinkedBoard } from './useLinkedBoard';

/** Карточка вложенной доски: двойной щелчок — войти внутрь. */
const BoardLinkDataSchema = z.object({ boardId: BoardIdSchema });
type BoardLinkData = z.infer<typeof BoardLinkDataSchema>;

function BoardLinkView({ element, data }: ElementViewProps<BoardLinkData>) {
  const board = useLinkedBoard(data.boardId);
  const runtime = useElementRuntime();
  const [count, setCount] = useState<number | null>(null);
  const gone = board.status !== 'ready';
  const title = gone
    ? t(`elements.board.${board.status === 'missing' ? 'missing' : 'deleted'}`)
    : board.title || t('project.gallery.untitled');
  const Preview = runtime.BoardPreview;
  const color = element.color === 'default' ? 'purple' : element.color;
  if (Preview === undefined)
    return (
      <div className={styles.compact}>
        <div
          className={styles.symbol}
          style={{ background: cardColor(color), color: inkColor(color) }}
          aria-hidden="true"
        >
          <Icon name="board" size={48} />
        </div>
        <div className={styles.compactTitle}>{title}</div>
      </div>
    );
  return (
    <div className={styles.card} data-linked-board={data.boardId}>
      <div className={styles.preview}>
        {!gone && (
          <Preview boardId={data.boardId} onCount={setCount} eager={runtime.exporting === true} />
        )}
        {(gone || count === 0) && (
          <div className={styles.empty}>
            <Icon name="board" size={28} />
            {gone ? title : t('project.gallery.empty')}
          </div>
        )}
        <span className={styles.badge} style={{ color: inkColor(color) }}>
          <Icon name="board" size={20} />
        </span>
      </div>
      <div className={styles.details}>
        <div className={styles.caption}>
          <div className={gone ? styles.titleMuted : styles.title} title={title}>
            {title}
          </div>
          <div className={styles.meta}>
            {count === null || gone ? (
              t('elementTypes.board')
            ) : (
              <>
                {t('elements.board.cards', { count })}
                <span className={styles.kind}>
                  {' · '}
                  {t('elementTypes.board')}
                </span>
              </>
            )}
          </div>
        </div>
        {runtime.openBoard !== undefined && (
          <button
            {...{ [CONTROL_ATTRIBUTE]: '' }}
            type="button"
            className={styles.open}
            disabled={gone}
            aria-label={t('elements.board.open', { title })}
            title={t('elements.board.open', { title })}
            onClick={(event) => {
              event.stopPropagation();
              runtime.openBoard?.(data.boardId);
            }}
          >
            <Icon name="line" size={18} />
          </button>
        )}
      </div>
    </div>
  );
}

export const boardLink = defineElement<BoardLinkData>({
  type: 'board',
  label: () => t('elementTypes.board'),
  dataSchema: BoardLinkDataSchema,
  defaultSize: { width: 240, height: 200 },
  minSize: { width: 160, height: 150 },
  resize: 'both',
  richText: false,
  activate: 'open',
  createData: () => ({ boardId: BoardIdSchema.parse('00000000') }),
  View: BoardLinkView,
  toPlainText: () => '',
  target: (data) => ({ kind: 'board', id: data.boardId }),
  withTarget: (_data, boardId) => BoardLinkDataSchema.parse({ boardId }),
});
