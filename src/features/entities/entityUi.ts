import { createStore, type StoreApi } from 'zustand/vanilla';
import type { EntityId } from '../../core';
import type { BoardFeed, ClipboardPayload } from '../board';
import { entityPayload } from '../board';

/** Открытые окна сущностей на экране проекта (эфемерное состояние интерфейса). */
export interface EntityUiState {
  readonly libraryOpen: boolean;
  readonly typesOpen: boolean;
  /** Сущность в панели; null — панель закрыта. */
  readonly entityId: EntityId | null;
  readonly deletingId: EntityId | null;
}

export interface EntityUi {
  readonly store: StoreApi<EntityUiState>;
  readonly openLibrary: () => void;
  readonly openEntity: (entityId: string) => void;
  /** Карточка сущности — на открытую доску (её забирает доска). */
  readonly place: (entityId: string) => void;
  readonly placements: BoardFeed<ClipboardPayload>;
}

export function createEntityUi(isEntity: (id: string) => id is EntityId): EntityUi {
  const store = createStore<EntityUiState>(() => ({
    libraryOpen: false,
    typesOpen: false,
    entityId: null,
    deletingId: null,
  }));
  let pending: ClipboardPayload[] = [];
  const listeners = new Set<() => void>();
  return {
    store,
    openLibrary: () => {
      store.setState({ libraryOpen: true });
    },
    openEntity: (entityId) => {
      if (isEntity(entityId)) store.setState({ entityId });
    },
    place: (entityId) => {
      pending = [...pending, entityPayload(entityId)];
      // На узком экране окна закрывают доску — убираем их, чтобы было видно, куда легла карточка.
      if (window.matchMedia('(max-width: 640px)').matches)
        store.setState({ libraryOpen: false, entityId: null });
      listeners.forEach((listener) => {
        listener();
      });
    },
    placements: {
      take: () => {
        const taken = pending;
        pending = [];
        return taken;
      },
      subscribe: (listener) => {
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
    },
  };
}
