import { deleteProjectIn, isProjectPath, type ProjectEntry } from '../../data';
import { projectLocation, waitForProjectClosed, type Workspace } from '../workspace';

/** Нужна папка-родитель: порт не разрешает удалять собственный корень. */
export function projectParent(path: string): { parent: string; folder: string } {
  const trimmed = path.replace(/[\\/]+$/, '');
  const index = Math.max(trimmed.lastIndexOf('/'), trimmed.lastIndexOf('\\'));
  if (index < 0 || index === trimmed.length - 1) throw new Error('Некорректный путь проекта');
  const parent =
    index === 0
      ? '/'
      : /^[a-z]:$/i.test(trimmed.slice(0, index))
        ? trimmed.slice(0, index + 1)
        : trimmed.slice(0, index);
  return { parent, folder: trimmed.slice(index + 1) };
}

export async function removeProject(
  workspace: Workspace,
  entry: Extract<ProjectEntry, { status: 'ok' }>,
): Promise<void> {
  await waitForProjectClosed(workspace.services, entry.folder);
  let fs = workspace.services.projectsFs;
  let folder = entry.folder;
  if (isProjectPath(folder)) {
    const location = await projectLocation(workspace.services, folder);
    const target = projectParent(location.path);
    const open = workspace.services.openFolder;
    if (open === null) throw new Error('Папка проекта недоступна');
    fs = (await open(target.parent)).fs;
    folder = target.folder;
  }
  const result = await deleteProjectIn(fs, folder, entry.meta.id);
  if (!result.ok) throw new Error(result.error);
  workspace.removeProjectPath(entry.folder);
}
