import { createStore } from 'zustand/vanilla';
import type { SaveState } from '../../data';

export type ProjectWarning = 'backup' | 'sync' | 'corrupt';

/** Состояние записи отдельных документов: успешная запись одного не скрывает ошибку другого. */
export function createProjectHealth() {
  const documents = new Map<string, SaveState>();
  const store = createStore<{
    readonly saving: SaveState;
    readonly warning: ProjectWarning | null;
  }>(() => ({ saving: 'saved', warning: null }));
  return {
    store,
    saved: (docId: string, state: SaveState) => {
      documents.set(docId, state);
      const states = new Set(documents.values());
      const saving = states.has('error')
        ? 'error'
        : states.has('saving')
          ? 'saving'
          : states.has('pending')
            ? 'pending'
            : 'saved';
      store.setState({ saving });
    },
    warn: (warning: ProjectWarning) => {
      store.setState({ warning });
    },
    dismiss: () => {
      store.setState({ warning: null });
    },
  };
}

export type ProjectHealth = ReturnType<typeof createProjectHealth>;
