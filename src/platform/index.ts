/**
 * Платформа: адаптеры Tauri (файлы, слежение за папкой, диалоги, буфер обмена), реализующие
 * порты из core. Подключается только в app.
 */
export {
  StorageError,
  createTauriFileSystem,
  createTauriFolderWatcher,
  openAppFolder,
  openProjectFolder,
  tauriBridge,
} from './tauriStorage';
export type { AppFolder, TauriBridge } from './tauriStorage';
export { isMobileDevice, isTauriRuntime } from './runtime';
export { androidFileOpener, androidStorage, onShared, takeSharedItems } from './android';
export type { AndroidStorage, SharedItem } from './android';
export { pickFolder } from './dialogs';
export { createTauriNetwork, openFileInSystem, openUrlInSystem } from './system';
export { saveFileInSystem, downloadFile } from './saveFile';
export { readSystemClipboard } from './clipboard';
