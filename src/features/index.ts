/**
 * Сценарии поверх холста и элементов: проекты, сущности, поиск, теги, шаблоны, экспорт, настройки.
 */
export { BOARD_HOTKEYS, BoardCanvas } from './board';
export { HomeScreen } from './home';
export { HotkeyList } from './hotkeys';
export { ProjectScreen } from './project';
export { SettingsScreen } from './settings';
export {
  WorkspaceContext,
  createWorkspace,
  useHistorySync,
  useSharedInbox,
  useWorkspace,
  useWorkspaceState,
} from './workspace';
export type { AppServices, OpenedFolder, Route, SharedItem, Workspace } from './workspace';
