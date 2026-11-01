import { useMemo, useState } from 'react';
import { type BoardId, type CommandEnvironment } from '../../core';
import type { AssetStore, OpenProject } from '../../data';
import { t } from '../../i18n';
import { EntityContext } from '../../elements';
import { EntityOverlays, useProjectEntities, type ProjectEntitiesSession } from '../entities';
import { useWorkspace, useWorkspaceState } from '../workspace';
import { BoardArea, useBoardDirectory } from './BoardArea';
import { BoardGallery } from './BoardGallery';
import { createGalleryActions } from './galleryActions';
import { BoardTree } from './BoardTree';
import { buildBoardTree } from './treeModel';
import { BoardHeader } from './BoardHeader';
import { RenameBoardDialog } from './RenameBoardDialog';
import { SyncStatus } from './SyncStatus';
import { useOpenProject } from './useOpenProject';
import { createProjectActions } from './projectActions';
import { useAllBoards } from './useBoards';
import { useProjectHost } from './useProjectHost';
import { ProjectOverlays } from './ProjectOverlays';
import { useProjectSearch } from './useProjectSearch';
import { BackButton, Message, MissingBoard, SearchButtons } from './ProjectParts';
import { createProjectUi, type ProjectUi } from './projectUi';
import { useProjectTags, useTagLinks, type ProjectTags } from '../tags';
import { useProjectAssets } from './useProjectAssets';
import styles from './Project.module.css';

const NARROW_SCREEN = '(max-width: 640px)';

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
  const allBoards = useAllBoards(project.projectDoc.doc);
  const boards = useMemo(() => allBoards.filter((item) => item.deletedAt === null), [allBoards]);
  const rootId = project.meta.rootBoardId;
  const tree = useMemo(() => buildBoardTree(boards, rootId), [boards, rootId]);
  // Доски выбирают на экране досок; дерево — по кнопке ☰, когда нужно прыгнуть вглубь.
  const [treeOpen, setTreeOpen] = useState(false);
  const [renaming, setRenaming] = useState<BoardId | null>(null);
  const directory = useBoardDirectory(project);
  const actions = useMemo(() => createProjectActions(project, environment), [project, environment]);
  const gallery = useMemo(
    () => createGalleryActions(project, environment, actions),
    [project, environment, actions],
  );
  const source = useMemo(
    () => ({ project, assets, boards: directory }),
    [project, assets, directory],
  );
  const board = boardId === null ? undefined : boards.find((item) => item.id === boardId);
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
  if (tree === null) return <Message text={t('project.noBoard')} />;
  // Доска пропала (удалили на другом устройстве) — назад к списку досок.
  if (boardId !== null && board === undefined) return <MissingBoard />;

  const renamed = renaming === null ? undefined : allBoards.find((item) => item.id === renaming);
  const openSearch = (): void => {
    ui.setState({ search: true });
  };

  return (
    <EntityContext.Provider value={session.links}>
      {board === undefined ? (
        <header className={styles.header}>
          <BackButton />
          <h1 className={styles.projectTitle}>{project.meta.name}</h1>
          <SearchButtons onSearch={openSearch} onLibrary={session.ui.openLibrary} />
          <SyncStatus folder={folder} />
        </header>
      ) : (
        <BoardHeader
          board={board}
          boards={boards}
          folder={folder}
          project={project}
          treeOpen={treeOpen}
          onToggleTree={() => {
            setTreeOpen(!treeOpen);
          }}
          onOpen={open}
          onRename={setRenaming}
          onSearch={openSearch}
          onLibrary={session.ui.openLibrary}
        />
      )}
      <div className={styles.body}>
        {board !== undefined && treeOpen && (
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
          {board === undefined ? (
            <BoardGallery
              allBoards={allBoards}
              rootId={rootId}
              folder={folder}
              projectId={project.meta.id}
              source={source}
              actions={gallery}
              onRename={setRenaming}
            />
          ) : (
            <BoardArea key={board.id} project={project} board={board} host={host} />
          )}
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
