import { useEffect, useMemo, useState } from 'react';
import { boardPath, type Board, type BoardId } from '../../core';
import type { OpenProject } from '../../data';
import { t } from '../../i18n';
import { Button } from '../../ui';
import { BoardCanvas, type BoardCameraMemory, type BoardHost } from '../board';
import { useWorkspace, useWorkspaceState } from '../workspace';
import { createBoardDirectory } from './boardDirectory';
import { BoardTree } from './BoardTree';
import { buildBoardTree } from './treeModel';
import { Breadcrumbs } from './Breadcrumbs';
import { RenameBoardDialog } from './RenameBoardDialog';
import { SyncStatus } from './SyncStatus';
import { useBoardDocument, useOpenProject } from './useOpenProject';
import { createProjectActions } from './projectActions';
import { useBoards } from './useBoards';
import { useProjectAssets } from './useProjectAssets';
import styles from './Project.module.css';

const NARROW_SCREEN = '(max-width: 640px)';

function Message({ text }: { readonly text: string }) {
  return <div className={styles.message}>{text}</div>;
}

function BackButton() {
  const workspace = useWorkspace();
  return (
    <Button variant="ghost" onClick={workspace.goHome}>
      {t('project.backToProjects')}
    </Button>
  );
}

/** Путь от корня до доски по данным проекта. */
function pathTo(board: Board, boards: readonly Board[]): Board[] {
  const byId = new Map(boards.map((item) => [item.id, item]));
  return boardPath(board.id, (id) => byId.get(id)?.parentId ?? null)
    .map((id) => byId.get(id))
    .filter((item): item is Board => item !== undefined);
}

function FavoriteButton({
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

function BoardArea({
  project,
  board,
  host,
}: {
  readonly project: OpenProject;
  readonly board: Board;
  readonly host: BoardHost;
}) {
  const workspace = useWorkspace();
  const { services, cameras } = workspace;
  const document = useBoardDocument(project, board.id);
  const environment = useMemo(() => ({ clock: services.clock, ids: services.ids }), [services]);
  const projectId = project.meta.id;
  const camera = useMemo<BoardCameraMemory>(
    () => ({
      initial: cameras.get(projectId, board.id),
      onChange: (value) => {
        cameras.set(projectId, board.id, value);
      },
    }),
    [cameras, projectId, board.id],
  );
  if (document.status !== 'ready')
    return <Message text={document.status === 'error' ? document.error : t('project.loading')} />;
  return (
    <BoardCanvas
      key={board.id}
      doc={document.value.doc}
      boardId={board.id}
      environment={environment}
      camera={camera}
      host={host}
      background={board.background}
    />
  );
}

function useBoardDirectory(project: OpenProject) {
  const directory = useMemo(() => createBoardDirectory(project.projectDoc.doc), [project]);
  useEffect(
    () => () => {
      directory.destroy();
    },
    [directory],
  );
  return directory;
}

function ProjectView({
  project,
  folder,
  boardId,
}: {
  readonly project: OpenProject;
  readonly folder: string;
  readonly boardId: BoardId | null;
}) {
  const workspace = useWorkspace();
  const { services } = workspace;
  const boards = useBoards(project.projectDoc.doc);
  const rootId = project.meta.rootBoardId;
  const tree = useMemo(() => buildBoardTree(boards, rootId), [boards, rootId]);
  const [treeOpen, setTreeOpen] = useState(() => !window.matchMedia(NARROW_SCREEN).matches);
  const [renaming, setRenaming] = useState<BoardId | null>(null);
  const assets = useProjectAssets(services, folder);
  const directory = useBoardDirectory(project);
  const actions = useMemo(
    () => createProjectActions(project, { clock: services.clock, ids: services.ids }),
    [project, services],
  );
  const board =
    boards.find((item) => item.id === boardId) ?? boards.find((item) => item.id === rootId);
  const currentId = board?.id ?? rootId;
  const host = useMemo<BoardHost>(
    () => ({
      assets,
      boards: directory,
      openBoard: workspace.openBoard,
      createBoard: () => actions.createChildBoard(currentId),
      renameBoard: setRenaming,
      setBackground: (background) => {
        actions.run({ kind: 'updateBoard', boardId: currentId, changes: { background } });
      },
      inbox: {
        take: workspace.takeInbox,
        subscribe: (listener) => workspace.store.subscribe(listener),
      },
    }),
    [assets, directory, workspace, actions, currentId],
  );
  if (board === undefined || tree === null) return <Message text={t('project.noBoard')} />;

  const open = (id: BoardId): void => {
    workspace.openBoard(id);
    if (window.matchMedia(NARROW_SCREEN).matches) setTreeOpen(false);
  };
  const createFromTree = (): void => {
    const created = actions.createChildBoard(board.id);
    if (created === null) return;
    void actions.addBoardCard(board.id, created).then(() => {
      open(created);
      setRenaming(created);
    });
  };
  const renamed = renaming === null ? undefined : boards.find((item) => item.id === renaming);

  return (
    <>
      <header className={styles.header}>
        <Button
          variant="ghost"
          pressed={treeOpen}
          aria-label={t('project.tree.title')}
          title={t('project.tree.title')}
          onClick={() => {
            setTreeOpen(!treeOpen);
          }}
        >
          {'☰'}
        </Button>
        <BackButton />
        <Breadcrumbs
          path={pathTo(board, boards)}
          onOpen={open}
          onRename={() => {
            setRenaming(board.id);
          }}
        />
        <SyncStatus folder={folder} />
        <FavoriteButton project={project} folder={folder} board={board} />
      </header>
      <div className={styles.body}>
        {treeOpen && (
          <>
            <div
              className={styles.treeBackdrop}
              onPointerDown={() => {
                setTreeOpen(false);
              }}
            />
            <BoardTree tree={tree} currentId={board.id} onOpen={open} onCreate={createFromTree} />
          </>
        )}
        <div className={styles.board}>
          <BoardArea key={board.id} project={project} board={board} host={host} />
        </div>
      </div>
      {renamed !== undefined && (
        <RenameBoardDialog
          key={renamed.id}
          title={renamed.title}
          onSave={(title) => actions.renameBoard(renamed.id, title)}
          onClose={() => {
            setRenaming(null);
          }}
        />
      )}
    </>
  );
}

/** Экран проекта: открывает проект с диска, дерево досок, крошки и доска. */
export function ProjectScreen({
  folder,
  boardId,
}: {
  readonly folder: string;
  readonly boardId: BoardId | null;
}) {
  const workspace = useWorkspace();
  const deviceId = useWorkspaceState((state) => state.settings.deviceId);
  const deviceName = useWorkspaceState((state) => state.settings.deviceName);
  const project = useOpenProject(workspace.services, deviceId, deviceName, folder);
  return (
    <div className={styles.screen}>
      {project.status === 'ready' ? (
        <ProjectView project={project.value} folder={folder} boardId={boardId} />
      ) : (
        <>
          <header className={styles.header}>
            <BackButton />
          </header>
          <Message text={project.status === 'error' ? project.error : t('project.loading')} />
        </>
      )}
    </div>
  );
}
