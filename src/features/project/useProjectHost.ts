import { useMemo } from 'react';
import type { BoardId } from '../../core';
import type { AssetStore } from '../../data';
import type { BoardDirectory } from '../../elements';
import type { BoardHost } from '../board';
import type { ProjectEntitiesSession } from '../entities';
import type { Workspace } from '../workspace';
import type { ProjectActions } from './projectActions';

interface HostParts {
  readonly assets: AssetStore | null;
  readonly directory: BoardDirectory;
  readonly workspace: Workspace;
  readonly actions: ProjectActions;
  readonly currentId: BoardId;
  readonly session: ProjectEntitiesSession;
  readonly renameBoard: (boardId: BoardId) => void;
}

/** Что доска получает от проекта: файлы, доски, сущности, «Поделиться», «На доску». */
export function useProjectHost(parts: HostParts): BoardHost {
  const { assets, directory, workspace, actions, currentId, session, renameBoard } = parts;
  return useMemo<BoardHost>(
    () => ({
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
      inbox: {
        take: workspace.takeInbox,
        subscribe: (listener) => workspace.store.subscribe(listener),
      },
    }),
    [assets, directory, workspace, actions, currentId, session, renameBoard],
  );
}
