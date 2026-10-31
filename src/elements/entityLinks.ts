import { createContext, useContext, useSyncExternalStore } from 'react';
import type * as Y from 'yjs';
import type { Entity, EntityType, Tag } from '../core';
import type { AssetStore, LiveRecords } from '../data';

export type Live<T> = Pick<LiveRecords<T>, 'subscribe' | 'getSnapshot'>;

/** Сущности открытого проекта: живые снимки типов и сущностей и тексты полей. */
export interface EntityDirectory {
  readonly entities: Live<Entity>;
  readonly types: Live<EntityType>;
  readonly textOf: (entityId: string, fieldId: string) => Y.XmlFragment | null;
}

/** Что нужно карточкам и упоминаниям сущностей; даёт экран проекта (вне проекта — null). */
export interface EntityLinks {
  readonly directory: EntityDirectory;
  readonly assets: AssetStore | null;
  readonly openEntity: (entityId: string) => void;
  /** Теги проекта (ADR 0006): для «#» в тексте и чипов тегов. */
  readonly tags: Live<Tag>;
  /** Новый тег по имени из текста («#новый»); null — не создан. */
  readonly createTag: (name: string) => string | null;
}

export const EntityContext = createContext<EntityLinks | null>(null);

export function useEntityLinks(): EntityLinks | null {
  return useContext(EntityContext);
}

const EMPTY = new Map<string, never>();
const noop = () => () => undefined;
const empty = () => EMPTY;

function useLive<T>(pick: (links: EntityLinks) => Live<T>): ReadonlyMap<string, T> {
  const links = useEntityLinks();
  const live = links === null ? null : pick(links);
  return useSyncExternalStore(live?.subscribe ?? noop, live?.getSnapshot ?? empty);
}

/** Сущности проекта без корзины. */
export function useEntities(): ReadonlyMap<string, Entity> {
  return useLive((links) => links.directory.entities);
}

export function useEntityTypes(): ReadonlyMap<string, EntityType> {
  return useLive((links) => links.directory.types);
}

/** Теги проекта по id (вне проекта — пусто). */
export function useTags(): ReadonlyMap<string, Tag> {
  return useLive((links) => links.tags);
}

/** Сущность с её типом; null — удалена, не найдена или тип недоступен. */
export function useEntity(
  entityId: string,
): { readonly entity: Entity; readonly type: EntityType } | null {
  const entity = useEntities().get(entityId);
  const type = useEntityTypes().get(entity?.typeId ?? '');
  return entity === undefined || type === undefined ? null : { entity, type };
}
