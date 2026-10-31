import { createStore, type StoreApi } from 'zustand/vanilla';
import type { BoardId } from '../../core';

/** Окна экрана проекта (эфемерное состояние интерфейса): теги, теги доски, поиск, шаблоны. */
export interface ProjectUiState {
  readonly tagManager: boolean;
  /** Доска, чьи теги правятся; null — окно закрыто. */
  readonly boardTags: BoardId | null;
  readonly search: boolean;
  /** Шаблоны: выбрать для новой доски или сохранить текущую. */
  readonly templates: 'pick' | 'save' | null;
}

export type ProjectUi = StoreApi<ProjectUiState>;

export function createProjectUi(): ProjectUi {
  return createStore<ProjectUiState>(() => ({
    tagManager: false,
    boardTags: null,
    search: false,
    templates: null,
  }));
}
