import { useMemo, useState } from 'react';
import type { Board, BoardId, ProjectId } from '../../core';
import { formatDateTime, t } from '../../i18n';
import { Button, Dialog, Icon } from '../../ui';
import { useWorkspace, useWorkspaceState } from '../workspace';
import type { PreviewSource } from './BoardPreview';
import { BoardTile, type TileCommands } from './BoardTile';
import type { GalleryActions } from './galleryActions';
import { galleryBoards } from './galleryModel';
import styles from './Gallery.module.css';

interface BoardGalleryProps {
  readonly allBoards: readonly Board[];
  readonly rootId: BoardId;
  readonly folder: string;
  readonly projectId: ProjectId;
  readonly source: PreviewSource;
  readonly actions: GalleryActions;
  readonly onRename: (boardId: BoardId) => void;
}

function useGalleryCommands(props: BoardGalleryProps, report: (error: string | null) => void) {
  const workspace = useWorkspace();
  const [removing, setRemoving] = useState<Board | null>(null);
  const commands: TileCommands = {
    open: (board) => {
      workspace.openBoard(board.id);
    },
    togglePin: (board) => {
      workspace.toggleFavorite({
        projectId: props.projectId,
        projectFolder: props.folder,
        boardId: board.id,
        title: board.title,
      });
    },
    rename: (board) => {
      props.onRename(board.id);
    },
    duplicate: (board) => {
      props.actions.duplicate(board).then(report, (error: unknown) => {
        report(String(error));
      });
    },
    remove: setRemoving,
  };
  return { commands, removing, setRemoving };
}

function DeletedBoards({
  boards,
  onRestore,
}: {
  readonly boards: readonly Board[];
  readonly onRestore: (board: Board) => void;
}) {
  if (boards.length === 0) return null;
  return (
    <details className={styles.trash}>
      <summary className={styles.trashTitle}>
        {t('project.gallery.trashCount', { count: boards.length })}
      </summary>
      <ul className={styles.trashList}>
        {boards.map((board) => (
          <li key={board.id} className={styles.trashItem}>
            <span className={styles.trashName}>{board.title}</span>
            <span className={styles.tileMeta}>
              {t('project.gallery.deletedAt', { date: formatDateTime(board.deletedAt ?? 0) })}
            </span>
            <Button
              variant="ghost"
              onClick={() => {
                onRestore(board);
              }}
            >
              {t('project.gallery.restore')}
            </Button>
          </li>
        ))}
      </ul>
    </details>
  );
}

/** Экран досок проекта: плитки с превью — между списком проектов и самой доской. */
export function BoardGallery(props: BoardGalleryProps) {
  const { allBoards, rootId, folder, source, actions, onRename } = props;
  const favorites = useWorkspaceState((state) => state.settings.favorites);
  const [error, setError] = useState<string | null>(null);
  const pinned = useMemo(
    () =>
      new Set(
        favorites
          .filter((favorite) => favorite.projectFolder === folder)
          .map((favorite) => favorite.boardId),
      ),
    [favorites, folder],
  );
  const { visible, deleted } = useMemo(
    () => galleryBoards(allBoards, rootId, pinned),
    [allBoards, rootId, pinned],
  );
  const { commands, removing, setRemoving } = useGalleryCommands(props, setError);
  return (
    <main className={styles.gallery}>
      {error !== null && <p className={styles.error}>{error}</p>}
      <div className={styles.grid}>
        <button
          type="button"
          className={styles.newTile}
          onClick={() => {
            actions.create().then(
              (created) => {
                if (created !== null) onRename(created);
              },
              (failure: unknown) => {
                setError(String(failure));
              },
            );
          }}
        >
          <span className={styles.newIcon}>
            <Icon name="plus" size={40} />
          </span>
          <span className={styles.tileTitle}>{t('project.gallery.new')}</span>
          <span className={styles.tileMeta}>{t('project.gallery.newHint')}</span>
        </button>
        {visible.map((board) => (
          <BoardTile
            key={board.id}
            board={board}
            source={source}
            pinned={pinned.has(board.id)}
            commands={board.id === rootId ? { ...commands, remove: null } : commands}
          />
        ))}
      </div>
      <DeletedBoards
        boards={deleted}
        onRestore={(board) => {
          setError(actions.restore(board));
        }}
      />
      {removing !== null && (
        <Dialog
          title={t('project.gallery.deleteTitle')}
          closeLabel={t('common.cancel')}
          onClose={() => {
            setRemoving(null);
          }}
        >
          <p>{t('project.gallery.deleteText', { title: removing.title })}</p>
          <Button
            variant="primary"
            onClick={() => {
              setError(actions.remove(removing));
              setRemoving(null);
            }}
          >
            {t('project.gallery.delete')}
          </Button>
        </Dialog>
      )}
    </main>
  );
}
