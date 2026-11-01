import { createStore, type StoreApi } from 'zustand/vanilla';
import type { BoardId, DeviceSettings, Favorite } from '../../core';
import { samePath, saveDeviceSettings, type CameraMemory } from '../../data';
import type { AppServices, SharedItem } from './services';

/** Где пользователь сейчас: главный экран, настройки или доска проекта. */
export type Route =
  | { readonly screen: 'home' }
  | { readonly screen: 'settings' }
  | { readonly screen: 'project'; readonly folder: string; readonly boardId: BoardId | null };

export interface WorkspaceState {
  readonly settings: DeviceSettings;
  readonly route: Route;
  /** Полученное через «Поделиться», ещё не положенное на доску. */
  readonly inbox: readonly SharedItem[];
}

export interface Workspace {
  readonly services: AppServices;
  /** Масштаб и позиция каждой доски на этом устройстве. */
  readonly cameras: CameraMemory;
  readonly store: StoreApi<WorkspaceState>;
  readonly updateSettings: (changes: Partial<Omit<DeviceSettings, 'version' | 'deviceId'>>) => void;
  readonly openProject: (folder: string, boardId?: BoardId | null) => void;
  /** null — экран досок проекта. */
  readonly openBoard: (boardId: BoardId | null) => void;
  readonly goHome: () => void;
  readonly openSettings: () => void;
  /** Переход по истории (кнопка «Назад» телефона): без новой записи в историю. */
  readonly restoreRoute: (route: Route) => void;
  readonly addToInbox: (items: readonly SharedItem[]) => void;
  /** Забирает всё полученное (доска кладёт его на себя). */
  readonly takeInbox: () => readonly SharedItem[];
  readonly isFavorite: (folder: string, boardId: BoardId) => boolean;
  readonly toggleFavorite: (favorite: Favorite) => void;
  /** Запоминает проект вне папки проектов (полный путь), чтобы он был в списке. */
  readonly addProjectPath: (path: string) => void;
  /** Убирает такой проект из списка (файлы не трогает). */
  readonly removeProjectPath: (path: string) => void;
}

const sameFavorite = (a: Favorite, folder: string, boardId: BoardId) =>
  a.projectFolder === folder && a.boardId === boardId;

/** Добавляет доску в избранное или убирает, если она уже там. */
function toggled(favorites: readonly Favorite[], favorite: Favorite): Favorite[] {
  const matches = (item: Favorite) => sameFavorite(item, favorite.projectFolder, favorite.boardId);
  return favorites.some(matches)
    ? favorites.filter((item) => !matches(item))
    : [...favorites, favorite];
}

/** Переходы между экранами и «Поделиться» (полученное ждёт, пока его заберёт доска). */
function navigation(
  store: StoreApi<WorkspaceState>,
): Pick<
  Workspace,
  | 'openProject'
  | 'openBoard'
  | 'goHome'
  | 'openSettings'
  | 'restoreRoute'
  | 'addToInbox'
  | 'takeInbox'
> {
  return {
    openProject: (folder, boardId = null) => {
      store.setState({ route: { screen: 'project', folder, boardId } });
    },
    openBoard: (boardId) => {
      const { route } = store.getState();
      if (route.screen === 'project') store.setState({ route: { ...route, boardId } });
    },
    goHome: () => {
      store.setState({ route: { screen: 'home' } });
    },
    openSettings: () => {
      store.setState({ route: { screen: 'settings' } });
    },
    restoreRoute: (route) => {
      store.setState({ route });
    },
    addToInbox: (items) => {
      if (items.length > 0) store.setState({ inbox: [...store.getState().inbox, ...items] });
    },
    takeInbox: () => {
      const { inbox } = store.getState();
      if (inbox.length > 0) store.setState({ inbox: [] });
      return inbox;
    },
  };
}

/** Состояние приложения на устройстве. Настройки сохраняются сразу после изменения. */
export function createWorkspace(
  services: AppServices,
  settings: DeviceSettings,
  cameras: CameraMemory,
): Workspace {
  const store = createStore<WorkspaceState>(() => ({
    settings,
    route: { screen: 'home' },
    inbox: [],
  }));
  let saving = Promise.resolve();
  const save = (next: DeviceSettings): void => {
    store.setState({ settings: next });
    // Записи идут по очереди: последняя всегда побеждает.
    saving = saving
      .then(() => saveDeviceSettings(services.settingsFs, next))
      .catch((error: unknown) => {
        console.error('Настройки не сохранились', error);
      });
  };
  const current = () => store.getState().settings;
  return {
    services,
    cameras,
    store,
    updateSettings: (changes) => {
      save({ ...current(), ...changes });
    },
    ...navigation(store),
    isFavorite: (folder, boardId) =>
      current().favorites.some((favorite) => sameFavorite(favorite, folder, boardId)),
    toggleFavorite: (favorite) => {
      save({ ...current(), favorites: toggled(current().favorites, favorite) });
    },
    addProjectPath: (path) => {
      const paths = current().projectPaths;
      if (!paths.some((known) => samePath(known, path)))
        save({ ...current(), projectPaths: [...paths, path] });
    },
    removeProjectPath: (path) => {
      const settings = current();
      save({
        ...settings,
        projectPaths: settings.projectPaths.filter((known) => !samePath(known, path)),
        favorites: settings.favorites.filter((favorite) => favorite.projectFolder !== path),
      });
    },
  };
}
