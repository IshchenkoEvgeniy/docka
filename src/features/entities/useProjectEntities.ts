import { useEffect, useMemo, useState } from 'react';
import type { CommandEnvironment, EntityId } from '../../core';
import type { AssetStore, OpenProject } from '../../data';
import type { EntityLinks } from '../../elements';
import type { BoardEntities } from '../board';
import { createEntityUi, type EntityUi } from './entityUi';
import { createProjectEntities, type ProjectEntities } from './projectEntities';

export interface ProjectEntitiesSession {
  readonly entities: ProjectEntities;
  readonly ui: EntityUi;
  /** Для карточек и упоминаний (EntityContext). */
  readonly links: EntityLinks;
  /** Для доски (BoardHost.entities). */
  readonly board: BoardEntities;
}

function createSession(project: OpenProject, environment: CommandEnvironment) {
  const entities = createProjectEntities(project.projectDoc.doc, environment);
  const isEntity = (id: string): id is EntityId => entities.stores.entities.getSnapshot().has(id);
  const ui = createEntityUi(isEntity);
  const board: BoardEntities = {
    exists: isEntity,
    duplicate: (entityId) => {
      if (!isEntity(entityId)) return null;
      const result = entities.run({ kind: 'duplicateEntity', entityId });
      return result.ok ? (result.value.createdId ?? null) : null;
    },
    history: entities.history,
    openLibrary: ui.openLibrary,
  };
  return { entities, ui, board };
}

/**
 * Сущности открытого проекта на время показа экрана; null — ещё создаются.
 * Создаются в эффекте, а не в useMemo: подписки на документ живут ровно столько, сколько экран.
 */
export function useProjectEntities(
  project: OpenProject,
  environment: CommandEnvironment,
  assets: AssetStore | null,
  tags: Pick<EntityLinks, 'tags' | 'createTag'> | null,
): ProjectEntitiesSession | null {
  const [base, setBase] = useState<ReturnType<typeof createSession> | null>(null);
  useEffect(() => {
    const created = createSession(project, environment);
    setBase(created);
    return () => {
      created.entities.destroy();
    };
  }, [project, environment]);
  return useMemo(
    () =>
      base === null || tags === null
        ? null
        : {
            ...base,
            links: {
              directory: base.entities.directory,
              assets,
              openEntity: base.ui.openEntity,
              tags: tags.tags,
              createTag: tags.createTag,
            },
          },
    [base, assets, tags],
  );
}
