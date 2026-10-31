import { createProjectIn, joinPath, readProjectEntry, samePath } from '../../data';
import { t } from '../../i18n';
import type { Workspace } from '../workspace';

/** Родительская папка пути (без последнего имени). */
function parentOf(path: string): string {
  return path.replace(/[\\/]+$/, '').replace(/[\\/][^\\/]*$/, '');
}

function nameOf(path: string): string {
  return path.replace(/[\\/]+$/, '').replace(/^.*[\\/]/, '');
}

/**
 * Ключ проекта для списка и маршрута: проекты прямо в папке проектов — по имени подпапки
 * (как раньше), остальные — по полному пути, который запоминается в настройках.
 */
function remember(workspace: Workspace, path: string): string {
  if (samePath(parentOf(path), workspace.services.projectsFolderLabel)) return nameOf(path);
  workspace.addProjectPath(path);
  return path;
}

export type Placed =
  { readonly ok: true; readonly key: string } | { readonly ok: false; readonly error: string };

/** Новый проект: в папке проектов (parent = null) или в выбранной папке. */
export async function createProjectAt(
  workspace: Workspace,
  parent: string | null,
  name: string,
): Promise<Placed> {
  const { services } = workspace;
  const { deviceId } = workspace.store.getState().settings;
  const context = { deviceId, clock: services.clock, ids: services.ids };
  const inLibrary = parent === null || samePath(parent, services.projectsFolderLabel);
  if (inLibrary || services.openFolder === null) {
    const created = await createProjectIn(services.projectsFs, context, name);
    if (!created.ok) return created;
    await created.value.project.close();
    return { ok: true, key: created.value.folder };
  }
  const folder = await services.openFolder(parent);
  const created = await createProjectIn(folder.fs, context, name);
  if (!created.ok) return created;
  await created.value.project.close();
  return { ok: true, key: remember(workspace, joinPath(folder.path, created.value.folder)) };
}

/** Уже существующий проект из любой папки (например, привезённый Syncthing отдельно). */
export async function addExistingProject(workspace: Workspace, path: string): Promise<Placed> {
  const { openFolder } = workspace.services;
  if (openFolder === null) return { ok: false, error: t('home.notProject') };
  const folder = await openFolder(path);
  const entry = await readProjectEntry(folder.fs, folder.path);
  if (entry === null) return { ok: false, error: t('home.notProject') };
  if (entry.status !== 'ok') return { ok: false, error: entry.error };
  return { ok: true, key: remember(workspace, folder.path) };
}
