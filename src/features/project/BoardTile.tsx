import { useCallback, useState } from 'react';
import type { Board } from '../../core';
import { t, type TranslationKey } from '../../i18n';
import { Icon, cx, type IconName } from '../../ui';
import { BoardPreview, type PreviewSource } from './BoardPreview';
import styles from './Gallery.module.css';

export interface TileCommands {
  readonly open: (board: Board) => void;
  readonly togglePin: (board: Board) => void;
  readonly rename: (board: Board) => void;
  readonly duplicate: (board: Board) => void;
  /** null — доску удалить нельзя (корневая). */
  readonly remove: ((board: Board) => void) | null;
}

function TileButton({
  icon,
  label,
  pressed,
  onClick,
}: {
  readonly icon: IconName;
  readonly label: TranslationKey;
  readonly pressed?: boolean;
  readonly onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={cx(styles.tileButton, pressed === true && styles.tileButtonOn)}
      aria-label={t(label)}
      aria-pressed={pressed}
      title={t(label)}
      onClick={onClick}
    >
      <Icon name={icon} size={20} />
    </button>
  );
}

/** Плитка доски: превью, название, число карточек и действия. */
export function BoardTile({
  board,
  source,
  pinned,
  commands,
}: {
  readonly board: Board;
  readonly source: PreviewSource;
  readonly pinned: boolean;
  readonly commands: TileCommands;
}) {
  const [count, setCount] = useState<number | null>(null);
  const onCount = useCallback((value: number) => {
    setCount(value);
  }, []);
  const remove = commands.remove;
  return (
    <article className={styles.tile}>
      <button
        type="button"
        className={styles.tileOpen}
        onClick={() => {
          commands.open(board);
        }}
      >
        <span className={styles.previewFrame}>
          <BoardPreview source={source} boardId={board.id} onCount={onCount} />
          {count === 0 && (
            <span className={styles.emptyBoard}>
              <Icon name="board" size={32} />
              {t('project.gallery.empty')}
            </span>
          )}
        </span>
        <span className={styles.tileTitle}>
          {board.title === '' ? t('project.gallery.untitled') : board.title}
        </span>
        <span className={styles.tileMeta}>
          {count === null ? ' ' : t('project.gallery.cards', { count })}
        </span>
      </button>
      <div className={styles.tileActions}>
        <TileButton
          icon="pin"
          label={pinned ? 'project.gallery.unpin' : 'project.gallery.pin'}
          pressed={pinned}
          onClick={() => {
            commands.togglePin(board);
          }}
        />
        <TileButton
          icon="edit"
          label="project.rename"
          onClick={() => {
            commands.rename(board);
          }}
        />
        <TileButton
          icon="copy"
          label="project.gallery.duplicate"
          onClick={() => {
            commands.duplicate(board);
          }}
        />
        {remove !== null && (
          <TileButton
            icon="trash"
            label="project.gallery.delete"
            onClick={() => {
              remove(board);
            }}
          />
        )}
      </div>
    </article>
  );
}
