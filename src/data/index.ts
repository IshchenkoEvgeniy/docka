/**
 * Данные: Yjs-документы, репозитории, журналы и снимки, слияние правок разных устройств, undo.
 * Зависит только от core.
 */
export {
  BACKUP_KEEP,
  backupFileName,
  ensureDailyBackup,
  parseBackup,
  pruneBackups,
  restoreBackup,
  writeBackup,
} from './backup';
export { PURGE_ORIGIN, purgeBoardDocument, purgeProjectDocument } from './trashPurge';
export {
  LOCAL_ORIGIN,
  TYPING_MERGE_MS,
  UNDO_LIMIT,
  createUndoHistory,
  executeBoardCommand,
  executeProjectCommand,
} from './commands';
export type { UndoHistory, UndoOptions } from './commands';
export { createBoardConnectionsStore, createBoardElementsStore } from './boardElements';
export type { BoardConnectionsStore, BoardElementsStore, LiveRecords } from './boardElements';
export { openDocument } from './documentStore';
export type { DocumentStoreOptions, RefreshReport, StoredDocument } from './documentStore';
export { startLiveSync } from './liveSync';
export type { LiveSync, LiveSyncOptions } from './liveSync';
export { createProject, openProject } from './project';
export { PROJECT_FILE, readProjectMeta } from './projectMeta';
export type { ProjectFormat } from './projectMeta';
export { MIGRATIONS, checkMigrationChain, documentFormatVersion } from './migrations';
export type { Migration } from './migrations';
export type { OpenProject, ProjectContext } from './project';
export {
  insertBoard,
  readBoards,
  readConnections,
  readElements,
  readProjectName,
  readTags,
  writeProjectName,
} from './projectDocument';
export { createRecord, readCollection, updateRecord } from './yjsRecords';
export type { ReadResult, RecordMap } from './yjsRecords';
export { SETTINGS_FILE, loadDeviceSettings, saveDeviceSettings } from './deviceSettings';
export type { SettingsDefaults } from './deviceSettings';
export {
  PROJECT_EXTENSION,
  createProjectIn,
  isProjectPath,
  joinPath,
  listProjects,
  projectFolderName,
  readProjectEntry,
  samePath,
  sortProjects,
} from './projectLibrary';
export type { ProjectEntry } from './projectLibrary';
export { CAMERAS_FILE, loadCameraMemory } from './cameraMemory';
export type { CameraMemory } from './cameraMemory';
export {
  MEASURE_ORIGIN,
  TEXT_FIELD,
  TEXT_INIT_ORIGIN,
  ensureText,
  fillFragment,
  fragmentToRich,
  setMeasuredHeight,
  textOf,
} from './richText';
export {
  ASSETS_DIR,
  IMAGE_TYPES,
  MAX_ASSET_BYTES,
  createAssetStore,
  isAssetName,
} from './assetStore';
export type { AssetState, AssetStore } from './assetStore';
export { listProjectDevices, recordDeviceName } from './devices';
export type { ProjectDevice } from './devices';
