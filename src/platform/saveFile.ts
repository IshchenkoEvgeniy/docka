import { save } from '@tauri-apps/plugin-dialog';
import type { FileSaver } from '../core';
import { androidFileSaver } from './android';
import { createTauriFileSystem, openProjectFolder } from './tauriStorage';

export const saveFileInSystem: FileSaver = async (file) => {
  const android = androidFileSaver();
  if (android !== null) return android(file);
  const extension = file.name.split('.').at(-1) ?? 'png';
  const path = await save({
    defaultPath: file.name,
    filters: [{ name: extension.toUpperCase(), extensions: [extension] }],
  });
  if (path === null) return false;
  const slash = Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\'));
  if (slash < 0) throw new Error('Некорректный путь экспорта');
  const root = await openProjectFolder(path.slice(0, slash + 1));
  await createTauriFileSystem(root).writeFileAtomic(path.slice(slash + 1), file.bytes);
  return true;
};

/** Браузерный режим разработки: загрузка файла в обычную папку загрузок. */
export const downloadFile: FileSaver = (file) => {
  const url = URL.createObjectURL(new Blob([file.bytes.slice().buffer], { type: file.mime }));
  const link = document.createElement('a');
  link.download = file.name;
  link.href = url;
  link.click();
  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 60_000);
  return Promise.resolve(true);
};
