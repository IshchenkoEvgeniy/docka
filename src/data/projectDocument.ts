import type * as Y from 'yjs';
import {
  BoardSchema,
  ConnectionSchema,
  ElementSchema,
  TagSchema,
  type Board,
  type Tag,
} from '../core';
import { createRecord, readCollection, type ReadResult } from './yjsRecords';

/**
 * Раскладка данных по Yjs-документам (docs/format.md):
 * - документ проекта: `meta` (название), `boards` (дерево досок), `tags`;
 * - документ доски: `elements`, `connections`.
 * Здесь — только низкоуровневые чтение и запись; изменения из интерфейса идут через команды (шаг 1.6).
 */

export const PROJECT_DOC_ID = 'project';

const boardsOf = (projectDoc: Y.Doc) => projectDoc.getMap<unknown>('boards');
const tagsOf = (projectDoc: Y.Doc) => projectDoc.getMap<unknown>('tags');
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
