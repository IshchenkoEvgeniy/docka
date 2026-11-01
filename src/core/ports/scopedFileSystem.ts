import type { FolderWatcher } from './folderWatcher';
import type { FileSystem } from './fileSystem';

/** Файловая система внутри подпапки: например, проект «Игра.doska» в папке проектов. */
export function scopedFileSystem(fs: FileSystem, folder: string): FileSystem {
  const inside = (path: string): string => (path === '' ? folder : `${folder}/${path}`);
  return {
    readFile: (path) => fs.readFile(inside(path)),
    writeFileAtomic: (path, data) => fs.writeFileAtomic(inside(path), data),
    appendFile: (path, data) => fs.appendFile(inside(path), data),
    listDir: (path) => fs.listDir(inside(path)),
    removeFile: (path) => fs.removeFile(inside(path)),
    removeDirectory: (path) =>
      path === ''
        ? Promise.reject(new Error('INVALID_PATH: нельзя удалить корень'))
        : fs.removeDirectory(inside(path)),
    latestChange: (path) => fs.latestChange(inside(path)),
  };
}

/** Слежение внутри подпапки: пути в событиях — относительно неё. */
export function scopedFolderWatcher(watcher: FolderWatcher, folder: string): FolderWatcher {
  const prefix = `${folder}/`;
  return {
    watch: (path, onChange) =>
      watcher.watch(path === '' ? folder : `${folder}/${path}`, (changed) => {
        onChange(
          changed.map((item) => (item.startsWith(prefix) ? item.slice(prefix.length) : item)),
        );
      }),
  };
}
