import { useMemo, useState } from 'react';
import type { Board, BoardId } from '../../core';
import type { OpenProject } from '../../data';
import {
  createSearchIndex,
  type PaletteCommand,
  type SearchDoc,
  type SearchIndex,
} from '../search';
import type { Workspace } from '../workspace';
import { createFocusFeed, type FocusFeed } from './focusFeed';
import { paletteCommands } from './paletteCommands';
import type { ProjectUi } from './projectUi';

export interface ProjectSearch {
  readonly index: SearchIndex;
  readonly focus: FocusFeed;
  readonly commands: readonly PaletteCommand[];
  readonly openDoc: (doc: SearchDoc) => void;
}

interface SearchParts {
  readonly project: OpenProject;
  readonly workspace: Workspace;
  readonly ui: ProjectUi;
  readonly boards: readonly Board[];
  readonly currentId: BoardId;
  readonly open: (boardId: BoardId) => void;
  readonly openEntity: (entityId: string) => void;
  readonly openLibrary: () => void;
  readonly createBoard: () => void;
}

/** Поиск проекта: индекс (живёт, пока открыт проект), команды Ctrl+K и переход к найденному. */
export function useProjectSearch(parts: SearchParts): ProjectSearch {
  const { project, workspace, ui, boards, currentId, open, openEntity } = parts;
  const index = useMemo(() => createSearchIndex(project), [project]);
  const [focus] = useState(createFocusFeed);
  const commands = paletteCommands({
    workspace,
    ui,
    currentId,
    createBoard: parts.createBoard,
    openLibrary: parts.openLibrary,
  });
  const openDoc = (doc: SearchDoc): void => {
    if (doc.kind === 'entity') {
      openEntity(doc.targetId);
      return;
    }
    const board = boards.find((item) => item.id === doc.boardId);
    if (board === undefined) return;
    if (doc.kind === 'element') focus.push(board.id, doc.targetId);
    open(board.id);
  };
  return { index, focus, commands, openDoc };
}
