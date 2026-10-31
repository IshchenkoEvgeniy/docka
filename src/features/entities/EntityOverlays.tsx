import { useEffect, useState } from 'react';
import { useStore } from 'zustand';
import type { BoardId, EntityId } from '../../core';
import type { AssetStore, OpenProject } from '../../data';
import { t } from '../../i18n';
import { DeleteEntityDialog } from './DeleteEntityDialog';
import { EntityPanel } from './EntityPanel';
import { Library } from './Library';
import { TypeEditor } from './TypeEditor';
import type { ProjectEntitiesSession } from './useProjectEntities';
import styles from './Entities.module.css';

const NOTICE_MS = 4000;

/** Сообщение внизу экрана, которое само скрывается. */
function useNotice(): [string | null, (message: string) => void] {
  const [notice, setNotice] = useState<string | null>(null);
  useEffect(() => {
    if (notice === null) return undefined;
    const timer = setTimeout(() => {
      setNotice(null);
    }, NOTICE_MS);
    return () => {
      clearTimeout(timer);
    };
  }, [notice]);
  return [notice, setNotice];
}

/** Картинка для поля «изображение»: в assets/ проекта; ошибка — в журнал и сообщением. */
function imageStorer(assets: AssetStore | null, notify: (message: string) => void) {
  return async (file: File): Promise<string | null> => {
    if (assets === null) return null;
    const stored = await assets.put(new Uint8Array(await file.arrayBuffer()), file.type);
    if (stored.ok) return stored.value;
    console.error('Картинка не сохранена', stored.error);
    notify(t('entities.panel.imageFailed', { error: stored.error }));
    return null;
  };
}

/** Окна сущностей поверх доски: библиотека, панель сущности, типы, удаление. */
export function EntityOverlays({
  session,
  project,
  assets,
  onOpenBoard,
}: {
  readonly session: ProjectEntitiesSession;
  readonly project: OpenProject;
  readonly assets: AssetStore | null;
  readonly onOpenBoard: (boardId: BoardId) => void;
}) {
  const { entities, ui } = session;
  const state = useStore(ui.store);
  const set = ui.store.setState;
  const [notice, notify] = useNotice();
  const create = (typeId: string): EntityId | null => {
    const type = entities.stores.types.getSnapshot().get(typeId);
    if (type === undefined) return null;
    const result = entities.run({ kind: 'createEntity', typeId: type.id, name: '' });
    if (!result.ok) notify(result.error);
    const id = result.ok ? result.value.createdId : undefined;
    return id === undefined ? null : (entities.stores.entities.getSnapshot().get(id)?.id ?? null);
  };
  return (
    <>
      {state.libraryOpen && (
        <Library
          onClose={() => {
            set({ libraryOpen: false });
          }}
          onOpenTypes={() => {
            set({ typesOpen: true });
          }}
          onCreate={create}
          actions={{
            open: ui.openEntity,
            place: ui.place,
            remove: (id) => {
              const entity = entities.stores.entities.getSnapshot().get(id);
              if (entity !== undefined) set({ deletingId: entity.id });
            },
          }}
        />
      )}
      {state.entityId !== null && (
        <EntityPanel
          key={state.entityId}
          project={project}
          entities={entities}
          entityId={state.entityId}
          storeImage={imageStorer(assets, notify)}
          onClose={() => {
            set({ entityId: null });
          }}
          onOpenBoard={(boardId) => {
            set({ entityId: null, libraryOpen: false });
            onOpenBoard(boardId);
          }}
          onPlace={ui.place}
          onOpenEntity={ui.openEntity}
        />
      )}
      {state.typesOpen && (
        <TypeEditor
          entities={entities}
          onClose={() => {
            set({ typesOpen: false });
          }}
        />
      )}
      {state.deletingId !== null && (
        <DeleteEntityDialog
          project={project}
          entities={entities}
          entityId={state.deletingId}
          onClose={() => {
            set({ deletingId: null });
          }}
        />
      )}
      {notice !== null && (
        <div className={styles.notice} role="status">
          {notice}
        </div>
      )}
    </>
  );
}
