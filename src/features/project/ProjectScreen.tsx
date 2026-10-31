import { useEffect, useMemo, useState } from 'react';
import { type Board, type BoardId, type CommandEnvironment } from '../../core';
import type { AssetStore, OpenProject } from '../../data';
import { t } from '../../i18n';
import { Button } from '../../ui';
import { EntityContext } from '../../elements';
import { BoardCanvas, type BoardCameraMemory, type BoardHost } from '../board';
import { EntityOverlays, useProjectEntities, type ProjectEntitiesSession } from '../entities';
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
import { useProjectHost } from './useProjectHost';
import { ProjectOverlays } from './ProjectOverlays';
import { useProjectSearch } from './useProjectSearch';
import { BackButton, FavoriteButton, Message, pathTo } from './ProjectParts';
import { createProjectUi, type ProjectUi } from './projectUi';
import { useProjectTags, useTagLinks, type ProjectTags } from '../tags';
import { useProjectAssets } from './useProjectAssets';
import styles from './Project.module.css';

const NARROW_SCREEN = '(max-width: 640px)';

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

interface ProjectBodyProps {
  readonly project: OpenProject;
  readonly folder: string;
  readonly boardId: BoardId | null;
  readonly assets: AssetStore | null;
  readonly openAsset: ((asset: string, mime: string) => Promise<void>) | null;
  readonly environment: CommandEnvironment;
  readonly session: ProjectEntitiesSession;
  readonly tags: ProjectTags;
  readonly ui: ProjectUi;
}

/** Сущности создаются в эффекте — до тех пор показывается «Открываю…». */
function ProjectView({
  project,
  folder,
  boardId,
}: {
  readonly project: OpenProject;
  readonly folder: string;
  readonly boardId: BoardId | null;
}) {
  const { services } = useWorkspace();
  const { assets, openAsset } = useProjectAssets(services, folder);
  const environment = useMemo(() => ({ clock: services.clock, ids: services.ids }), [services]);
  const tags = useProjectTags(project, environment);
  const session = useProjectEntities(project, environment, assets, useTagLinks(tags));
  const [ui] = useState(createProjectUi);
  if (session === null || tags === null) return <Message text={t('project.loading')} />;
  const props = { project, folder, boardId, assets, openAsset, environment, session, tags, ui };
  return <ProjectBody {...props} />;
}

function ProjectBody(props: ProjectBodyProps) {
  const { project, folder, boardId, assets, openAsset, environment, session, tags, ui } = props;
  const workspace = useWorkspace();
  const boards = useBoards(project.projectDoc.doc);
  const rootId = project.meta.rootBoardId;
  const tree = useMemo(() => buildBoardTree(boards, rootId), [boards, rootId]);
  const [treeOpen, setTreeOpen] = useState(() => !window.matchMedia(NARROW_SCREEN).matches);
  const [renaming, setRenaming] = useState<BoardId | null>(null);
  const directory = useBoardDirectory(project);
  const actions = useMemo(() => createProjectActions(project, environment), [project, environment]);
  const board =
    boards.find((item) => item.id === boardId) ?? boards.find((item) => item.id === rootId);
  const currentId = board?.id ?? rootId;
  const open = (id: BoardId): void => {
    workspace.openBoard(id);
    if (window.matchMedia(NARROW_SCREEN).matches) setTreeOpen(false);
  };
  const createFromTree = (): void => {
    const created = actions.createChildBoard(currentId);
    if (created === null) return;
    void actions.addBoardCard(currentId, created).then(() => {
      open(created);
      setRenaming(created);
    });
  };
  const search = useProjectSearch({
    project,
    workspace,
    ui,
    boards,
    currentId,
    open,
    openEntity: session.ui.openEntity,
    openLibrary: session.ui.openLibrary,
    createBoard: createFromTree,
  });
  const host = useProjectHost({
    assets,
    directory,
    workspace,
    actions,
    currentId,
    session,
    renameBoard: setRenaming,
    openAsset,
    tags,
    ui,
    focus: search.focus,
  });
  if (board === undefined || tree === null) return <Message text={t('project.noBoard')} />;

  const renamed = renaming === null ? undefined : boards.find((item) => item.id === renaming);

  return (
    <EntityContext.Provider value={session.links}>
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
        <Button
          variant="ghost"
          onClick={() => {
            ui.setState({ search: true });
          }}
          title={t('project.search')}
        >
          {t('project.searchButton')}
        </Button>
        <Button variant="ghost" onClick={session.ui.openLibrary} title={t('project.entities')}>
          {t('project.entitiesButton')}
        </Button>
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
            <BoardTree
              tree={tree}
              currentId={board.id}
              onOpen={open}
              onCreate={createFromTree}
              onCreateFromTemplate={() => {
                ui.setState({ templates: 'pick' });
              }}
            />
          </>
        )}
        <div className={styles.board}>
          <BoardArea key={board.id} project={project} board={board} host={host} />
          <EntityOverlays
            session={session}
            project={project}
            assets={assets}
            onOpenBoard={open}
            tags={tags}
          />
          <ProjectOverlays
            ui={ui}
            tags={tags}
            actions={actions}
            boards={boards}
            search={search}
            now={workspace.services.clock.now}
            templates={{
              project,
              environment,
              currentId,
              onCreated: (created) => {
                void actions.addBoardCard(currentId, created).then(() => {
                  open(created);
                });
              },
            }}
          />
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
    </EntityContext.Provider>
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
