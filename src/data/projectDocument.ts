import type * as Y from 'yjs';
import {
  BoardSchema,
  ConnectionSchema,
  ElementSchema,
  EntitySchema,
  EntityTypeSchema,
  TagSchema,
  type Entity,
  type EntityType,
  type Board,
  type Tag,
} from '../core';
import { createRecord, readCollection, type ReadResult } from './yjsRecords';

/**
 * Раскладка данных по Yjs-документам (docs/format.md):
 * - документ проекта: `meta` (название), `boards` (дерево досок), `tags`, `entityTypes`, `entities`;
 * - документ доски: `elements`, `connections`.
 * Здесь — только низкоуровневые чтение и запись; изменения из интерфейса идут через команды (шаг 1.6).
 */

export const PROJECT_DOC_ID = 'project';

const boardsOf = (projectDoc: Y.Doc) => projectDoc.getMap<unknown>('boards');
const tagsOf = (projectDoc: Y.Doc) => projectDoc.getMap<unknown>('tags');
export const ENTITY_TYPES_MAP = 'entityTypes';
export const ENTITIES_MAP = 'entities';
const metaOf = (projectDoc: Y.Doc) => projectDoc.getMap<unknown>('meta');

export function readBoards(projectDoc: Y.Doc): ReadResult<Board> {
  return readCollection(boardsOf(projectDoc), BoardSchema);
}

export function readTags(projectDoc: Y.Doc): ReadResult<Tag> {
  return readCollection(tagsOf(projectDoc), TagSchema);
}

export function insertBoard(projectDoc: Y.Doc, board: Board): void {
  boardsOf(projectDoc).set(board.id, createRecord(board));
}

/** Текущее название проекта; до первого переименования — название из project.json. */
export function readProjectName(projectDoc: Y.Doc, fallback: string): string {
  const name = metaOf(projectDoc).get('name');
  return typeof name === 'string' && name.trim() !== '' ? name : fallback;
}

export function writeProjectName(projectDoc: Y.Doc, name: string): void {
  metaOf(projectDoc).set('name', name);
}

export function readElements(boardDoc: Y.Doc) {
  return readCollection(boardDoc.getMap<unknown>('elements'), ElementSchema);
}

export function readConnections(boardDoc: Y.Doc) {
  return readCollection(boardDoc.getMap<unknown>('connections'), ConnectionSchema);
}

export function readEntityTypes(projectDoc: Y.Doc): ReadResult<EntityType> {
  return readCollection(projectDoc.getMap<unknown>(ENTITY_TYPES_MAP), EntityTypeSchema);
}

export function readEntities(projectDoc: Y.Doc): ReadResult<Entity> {
  return readCollection(projectDoc.getMap<unknown>(ENTITIES_MAP), EntitySchema);
}
