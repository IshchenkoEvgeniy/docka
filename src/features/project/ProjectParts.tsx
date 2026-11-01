import { boardPath, type Board } from '../../core';
import type { OpenProject } from '../../data';
import { t } from '../../i18n';
import { Button } from '../../ui';
import { useWorkspace, useWorkspaceState } from '../workspace';
import styles from './Project.module.css';

/** Мелкие части экрана проекта: сообщение, «Назад», путь до доски, избранное. */

export function Message({ text }: { readonly text: string }) {
  return <div className={styles.message}>{text}</div>;
}

export function BackButton() {
  const workspace = useWorkspace();
  return (
    <Button variant="ghost" onClick={workspace.goHome}>
      {t('project.backToProjects')}
    </Button>
  );
}

/** С доски — к списку досок проекта. */
export function BoardsButton() {
  const workspace = useWorkspace();
  return (
    <Button
      variant="ghost"
      onClick={() => {
        workspace.openBoard(null);
      }}
    >
      {t('project.backToBoards')}
    </Button>
  );
}

/** Открытой доски больше нет (удалили здесь или на другом устройстве). */
export function MissingBoard() {
  return (
    <div className={styles.message}>
      <p>{t('project.boardMissing')}</p>
      <BoardsButton />
    </div>
  );
}

export function SearchButtons({
  onSearch,
  onLibrary,
}: {
  readonly onSearch: () => void;
  readonly onLibrary: () => void;
}) {
  return (
    <>
      <Button variant="ghost" onClick={onSearch} title={t('project.search')}>
        {t('project.searchButton')}
      </Button>
      <Button variant="ghost" onClick={onLibrary} title={t('project.entities')}>
        {t('project.entitiesButton')}
      </Button>
    </>
  );
}

/** Путь от корня до доски по данным проекта. */
export function pathTo(board: Board, boards: readonly Board[]): Board[] {
  const byId = new Map(boards.map((item) => [item.id, item]));
  return boardPath(board.id, (id) => byId.get(id)?.parentId ?? null)
    .map((id) => byId.get(id))
    .filter((item): item is Board => item !== undefined);
}

export function FavoriteButton({
  project,
  folder,
  board,
}: {
  readonly project: OpenProject;
  readonly folder: string;
  readonly board: Board;
}) {
  const workspace = useWorkspace();
  useWorkspaceState((state) => state.settings.favorites); // перерисовка при смене избранного
  const favorite = workspace.isFavorite(folder, board.id);
  const label = favorite ? t('project.unfavorite') : t('project.favorite');
  return (
    <Button
      variant="ghost"
      pressed={favorite}
      aria-label={label}
      title={label}
      onClick={() => {
        workspace.toggleFavorite({
          projectId: project.meta.id,
          projectFolder: folder,
          boardId: board.id,
          title: board.title,
        });
      }}
    >
      {favorite ? '★' : '☆'}
    </Button>
  );
}
