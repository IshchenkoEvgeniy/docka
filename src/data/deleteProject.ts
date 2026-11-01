import { err, ok, scopedFileSystem, type FileSystem, type ProjectId, type Result } from '../core';
import { readProjectMeta } from './projectMeta';

/** Повторная проверка id защищает от удаления другой папки после обновления списка. */
export async function deleteProjectIn(
  fs: FileSystem,
  folder: string,
  expectedId: ProjectId,
): Promise<Result<void>> {
  if (folder === '' || folder === '.' || folder === '..' || /[\\/:]/.test(folder))
    return err('Некорректная папка проекта');
  const meta = await readProjectMeta(scopedFileSystem(fs, folder));
  if (!meta.ok) return meta;
  if (meta.value.id !== expectedId) return err('Проект в этой папке изменился. Обновите список.');
  await fs.removeDirectory(folder);
  return ok(undefined);
}
