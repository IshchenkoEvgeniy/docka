import { useMemo } from 'react';
import type { BoardId } from '../../core';
import type { AssetStore } from '../../data';
import type { BoardDirectory } from '../../elements';
import type { BoardHost } from '../board';
import type { ProjectEntitiesSession } from '../entities';
import type { Workspace } from '../workspace';
import type { ProjectTags } from '../tags';
import type { ProjectActions } from './projectActions';
import type { FocusFeed } from './focusFeed';
import type { ProjectUi } from './projectUi';
import { createLinkedBoardPreview } from './linkedBoardPreview';
import type { PreviewSource } from './BoardPreview';

interface HostParts {
  readonly previewSource: PreviewSource;
  readonly assets: AssetStore | null;
  readonly directory: BoardDirectory;
  readonly workspace: Workspace;
  readonly actions: ProjectActions;
  readonly currentId: BoardId;
  readonly session: ProjectEntitiesSession;
  readonly renameBoard: (boardId: BoardId) => void;
  readonly openAsset: ((asset: string, mime: string) => Promise<void>) | null;
  readonly tags: ProjectTags;
  readonly ui: ProjectUi;
  readonly focus: FocusFeed;
}

/** Окна проекта, которые открывает доска: теги, теги доски, поиск. */
function projectWindows(ui: ProjectUi, currentId: BoardId, workspace: Workspace) {
  return {
    saveFile: workspace.services.saveFile,
    readClipboard: workspace.services.readClipboard,
    openTagManager: () => {
      ui.setState({ tagManager: true });
    },
    editBoardTags: () => {
      ui.setState({ boardTags: currentId });
    },
    openSearch: () => {
      ui.setState({ search: true });
    },
    saveAsTemplate: () => {
      ui.setState({ templates: 'save' });
    },
  };
}

/** Что доска получает от проекта: файлы, доски, сущности, «Поделиться», «На доску». */
export function useProjectHost(parts: HostParts): BoardHost {
  const { assets, directory, workspace, actions, currentId, session, renameBoard, openAsset } =
    parts;
  const { tags, ui, focus } = parts;
  const BoardPreview = useMemo(
    () => createLinkedBoardPreview(parts.previewSource),
    [parts.previewSource],
  );
  return useMemo<BoardHost>(
    () => ({
      BoardPreview,
      assets,
      boards: directory,
      openBoard: workspace.openBoard,
      openEntity: session.ui.openEntity,
      entities: session.board,
      placements: session.ui.placements,
      createBoard: () => actions.createChildBoard(currentId),
      renameBoard,
      setBackground: (background) => {
        actions.run({ kind: 'updateBoard', boardId: currentId, changes: { background } });
      },
      tags,
      ...projectWindows(ui, currentId, workspace),
      focus,
      network: workspace.services.network,
      openAsset,
      openUrl: workspace.services.openUrl,
      inbox: {
        take: workspace.takeInbox,
        subscribe: (listener) => workspace.store.subscribe(listener),
      },
    }),
    [
      assets,
      directory,
      workspace,
      actions,
      currentId,
      session,
      renameBoard,
      openAsset,
      tags,
      ui,
      focus,
      BoardPreview,
    ],
  );
}
