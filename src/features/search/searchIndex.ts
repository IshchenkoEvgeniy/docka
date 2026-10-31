import MiniSearch from 'minisearch';
import * as Y from 'yjs';
import { hasTag, searchTerm, tokenize, type BoardId, type Tag } from '../../core';
import type { OpenProject } from '../../data';
import { boardDocs, elementDocs, entityDocs, liveBoardIds, type SearchDoc } from './searchDocs';

/** Фильтры поиска (ТЗ, раздел 7): тип, тег, доска, дата изменения, невыполненные задачи. */
export interface SearchFilters {
  readonly type: string | null;
  /** Имя тега (с вложенными). */
  readonly tag: string | null;
  readonly boardId: string | null;
  /** Изменено не раньше этого момента; null — когда угодно. */
  readonly since: number | null;
  readonly openTasks: boolean;
}

export const NO_FILTERS: SearchFilters = {
  type: null,
  tag: null,
  boardId: null,
  since: null,
  openTasks: false,
};

const MAX_RESULTS = 60;

function hasFilters(filters: SearchFilters): boolean {
  return Object.values(filters).some((value) => value !== null && value !== false);
}

function matches(doc: SearchDoc, filters: SearchFilters, tags: ReadonlyMap<string, Tag>): boolean {
  if (filters.type !== null && doc.type !== filters.type) return false;
  if (filters.boardId !== null && doc.boardId !== filters.boardId) return false;
  if (filters.since !== null && doc.updatedAt < filters.since) return false;
  if (filters.openTasks && doc.openTasks === 0) return false;
  return filters.tag === null || hasTag(doc.tags, filters.tag, tags);
}

/** Индекс в памяти: MiniSearch по заголовку и тексту, записи — в своей карте по id. */
export interface DocIndex {
  readonly replace: (old: readonly string[], docs: readonly SearchDoc[]) => string[];
  readonly search: (
    query: string,
    filters: SearchFilters,
    tags: ReadonlyMap<string, Tag>,
  ) => SearchDoc[];
}

export function createDocIndex(): DocIndex {
  const docs = new Map<string, SearchDoc>();
  const mini = new MiniSearch<SearchDoc>({
    fields: ['title', 'text'],
    tokenize,
    processTerm: (term) => searchTerm(term) ?? false,
    searchOptions: { prefix: true, fuzzy: 0.2, boost: { title: 2 }, combineWith: 'AND' },
  });
  return {
    replace: (old, next) => {
      const gone = old.filter((id) => docs.delete(id));
      mini.discardAll(gone);
      mini.addAll(next);
      for (const doc of next) docs.set(doc.id, doc);
      return next.map((doc) => doc.id);
    },
    search: (query, filters, tags) => {
      const text = query.trim();
      if (text === '' && !hasFilters(filters)) return [];
      const docOf = (id: unknown) => docs.get(String(id));
      return mini
        .search(text === '' ? MiniSearch.wildcard : text, {
          filter: (result) => {
            const doc = docOf(result.id);
            return doc !== undefined && matches(doc, filters, tags);
          },
        })
        .slice(0, MAX_RESULTS)
        .flatMap((result) => {
          const doc = docOf(result.id);
          return doc === undefined ? [] : [doc];
        });
    },
  };
}

export interface SearchIndex {
  /** Перечитывает изменившиеся доски и сущности; первый раз — весь проект. */
  readonly refresh: () => Promise<void>;
  readonly search: DocIndex['search'];
}

/** Версия документа доски: при совпадении доска не перечитывается. */
const versionOf = (doc: Y.Doc) => Y.encodeStateVector(doc).join(',');

/**
 * Поиск по проекту (ADR 0006): доски загружаются по одной; не открытые — закрываются после
 * чтения; при следующем обновлении перечитываются только изменившиеся.
 */
export function createSearchIndex(project: OpenProject): SearchIndex {
  const index = createDocIndex();
  const boardIds = new Map<string, string[]>();
  const versions = new Map<string, string>();
  let projectIds: string[] = [];
  const refreshBoard = async (boardId: BoardId): Promise<void> => {
    const wasOpen = project.openBoardIds().includes(boardId);
    const board = await project.openBoard(boardId);
    const version = versionOf(board.doc);
    if (versions.get(boardId) !== version) {
      boardIds.set(
        boardId,
        index.replace(boardIds.get(boardId) ?? [], elementDocs(board.doc, boardId)),
      );
      versions.set(boardId, version);
    }
    if (!wasOpen) await project.closeBoard(boardId);
  };
  return {
    refresh: async () => {
      const doc = project.projectDoc.doc;
      projectIds = index.replace(projectIds, [...boardDocs(doc), ...entityDocs(doc)]);
      const live = liveBoardIds(doc);
      for (const [id, ids] of boardIds)
        if (!live.some((boardId) => boardId === id)) {
          index.replace(ids, []);
          boardIds.delete(id);
          versions.delete(id);
        }
      for (const boardId of live) {
        try {
          await refreshBoard(boardId);
        } catch (error: unknown) {
          console.error('Доска не прочитана для поиска', error);
        }
      }
    },
    search: index.search,
  };
}
