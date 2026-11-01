import type { Board, BoardId, CommandEnvironment } from '../../core';
import type { OpenProject } from '../../data';
import { t } from '../../i18n';
import { applyTemplate, captureTemplate } from '../templates';
import type { ProjectActions } from './projectActions';

/** Действия экрана досок: создать, дублировать, удалить в корзину и вернуть. */
export interface GalleryActions {
  /** Новая доска внутри корневой (карточкой на ней), сразу открывается переименование. */
  readonly create: () => Promise<BoardId | null>;
  readonly duplicate: (board: Board) => Promise<string | null>;
  readonly remove: (board: Board) => string | null;
  readonly restore: (board: Board) => string | null;
}

export function createGalleryActions(
  project: OpenProject,
  environment: CommandEnvironment,
  actions: ProjectActions,
): GalleryActions {
  const rootId = project.meta.rootBoardId;
  return {
    create: async () => {
      const created = actions.createChildBoard(rootId);
      if (created !== null) await actions.addBoardCard(rootId, created);
      return created;
    },
    // Копия собирается тем же механизмом, что шаблоны: элементы, стрелки, вложенные доски.
    duplicate: async (board) => {
      const parentId = board.parentId ?? rootId;
      const meta = { id: environment.ids.next(), name: board.title, description: '' };
      const template = await captureTemplate(project, board.id, meta);
      if (template === null) return t('project.gallery.notFound');
      const applied = await applyTemplate(project, environment, template, { parentId });
      if (!applied.ok) return applied.error;
      actions.renameBoard(applied.value, t('project.gallery.copyTitle', { title: board.title }));
      await actions.addBoardCard(parentId, applied.value);
      return null;
    },
    remove: (board) => {
      const result = actions.run({ kind: 'deleteBoard', boardId: board.id });
      return result.ok ? null : result.error;
    },
    restore: (board) => {
      const result = actions.run({ kind: 'restoreBoard', boardId: board.id });
      return result.ok ? null : result.error;
    },
  };
}
