import { scopedFileSystem, scopedFolderWatcher } from '../../core';
import { isProjectPath } from '../../data';
import type { AppServices, OpenedFolder } from './services';

/**
 * Папка проекта по ключу: имя подпапки в папке проектов или полный путь проекта в другом месте
 * (выбран при создании или открыт «Открыть проект из папки…»).
 */
export async function projectLocation(services: AppServices, key: string): Promise<OpenedFolder> {
  if (!isProjectPath(key)) {
    const watcher = services.projectsWatcher;
    return {
      path: key,
      fs: scopedFileSystem(services.projectsFs, key),
      watcher: watcher === null ? null : scopedFolderWatcher(watcher, key),
    };
  }
  if (services.openFolder === null) throw new Error('Папки вне папки проектов здесь недоступны');
  return services.openFolder(key);
}
