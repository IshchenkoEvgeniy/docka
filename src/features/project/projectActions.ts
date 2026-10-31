import { boundsOf } from '../../canvas';
import {
  type BoardId,
  type CommandEnvironment,
  type ProjectCommand,
  type Result,
  type CommandResult,
} from '../../core';
import {
  executeBoardCommand,
  executeProjectCommand,
  readElements,
  type OpenProject,
} from '../../data';
import { t } from '../../i18n';

/** Действия с досками проекта: создать вложенную, переименовать, положить карточку. */
export interface ProjectActions {
  readonly run: (command: ProjectCommand) => Result<CommandResult>;
  readonly createChildBoard: (parentId: BoardId) => BoardId | null;
  readonly renameBoard: (boardId: BoardId, title: string) => string | null;
  /** Карточка доски справа от содержимого родительской доски (когда доску создают из дерева). */
  readonly addBoardCard: (parentId: BoardId, boardId: BoardId) => Promise<void>;
}

const CARD = { width: 160, height: 150 };
const GAP = 48;

export function createProjectActions(
  project: OpenProject,
  environment: CommandEnvironment,
): ProjectActions {
  const run = (command: ProjectCommand) =>
    executeProjectCommand(project.projectDoc.doc, command, environment);
  return {
    run,
    createChildBoard: (parentId) => {
      const result = run({ kind: 'createBoard', parentId, title: t('project.newBoardTitle') });
      return result.ok && result.value.createdId !== undefined
        ? (result.value.createdId as BoardId) // команда createBoard создаёт id доски
        : null;
    },
    renameBoard: (boardId, title) => {
      const result = run({ kind: 'updateBoard', boardId, changes: { title } });
      return result.ok ? null : result.error;
    },
    addBoardCard: async (parentId, boardId) => {
      const parent = await project.openBoard(parentId);
      const live = readElements(parent.doc).items.filter((item) => item.deletedAt === null);
      const bounds = boundsOf(live);
      const x = bounds === null ? 0 : bounds.x + bounds.width + GAP;
      const y = bounds === null ? 0 : bounds.y;
      executeBoardCommand(
        parent.doc,
        parentId,
        { kind: 'createElement', type: 'board', placement: { x, y, ...CARD }, data: { boardId } },
        environment,
      );
    },
  };
}
