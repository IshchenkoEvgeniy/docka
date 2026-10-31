import { useCallback, useSyncExternalStore } from 'react';
import { z } from 'zod';
import { BoardIdSchema } from '../../core';
import { t } from '../../i18n';
import { cardColor } from '../../ui';
import { defineElement } from '../defineElement';
import { useElementRuntime } from '../runtime';
import type { ElementViewProps } from '../types';
import styles from './BoardLink.module.css';

/** Карточка вложенной доски: двойной щелчок — войти внутрь. */
const BoardLinkDataSchema = z.object({ boardId: BoardIdSchema });
type BoardLinkData = z.infer<typeof BoardLinkDataSchema>;

const noop = () => () => undefined;

function useLinkedBoard(boardId: string) {
  const { boards } = useElementRuntime();
  const getSnapshot = useCallback(() => {
    const board = boards?.get(boardId) ?? null;
    return board === null ? 'missing' : board.deleted ? 'deleted' : board.title;
  }, [boards, boardId]);
  return useSyncExternalStore(boards?.subscribe ?? noop, getSnapshot);
}

function BoardLinkView({ element, data }: ElementViewProps<BoardLinkData>) {
  const title = useLinkedBoard(data.boardId);
  const gone = title === 'missing' || title === 'deleted';
  return (
    <div className={styles.card}>
      <div
        className={styles.icon}
        style={{ background: cardColor(element.color === 'default' ? 'blue' : element.color) }}
        aria-hidden="true"
      >
        <span className={styles.cell} />
        <span className={styles.cell} />
        <span className={styles.cell} />
        <span className={styles.cell} />
      </div>
      <div className={gone ? styles.titleMuted : styles.title}>
        {title === 'missing'
          ? t('elements.board.missing')
          : title === 'deleted'
            ? t('elements.board.deleted')
            : title}
      </div>
    </div>
  );
}

export const boardLink = defineElement<BoardLinkData>({
  type: 'board',
  label: () => t('elementTypes.board'),
  dataSchema: BoardLinkDataSchema,
  defaultSize: { width: 160, height: 150 },
  minSize: { width: 160, height: 150 },
  resize: 'none',
  richText: false,
  activate: 'open',
  createData: () => ({ boardId: BoardIdSchema.parse('00000000') }),
  View: BoardLinkView,
  toPlainText: () => '',
  target: (data) => ({ kind: 'board', id: data.boardId }),
  withTarget: (_data, boardId) => BoardLinkDataSchema.parse({ boardId }),
});
