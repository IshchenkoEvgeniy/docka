import type * as Y from 'yjs';
import { mentionedIds, type Board, type BoardId } from '../../core';
import {
  entityTexts,
  fragmentToRich,
  readBoards,
  readElements,
  readEntities,
  textOf,
  type OpenProject,
} from '../../data';
import { definitionFor } from '../../elements';

/**
 * Где используется сущность (ADR 0004): на каких досках лежит и где упомянута.
 * Считается по запросу: открываются все доски проекта, не открытые — закрываются после подсчёта.
 */
export interface BoardUsage {
  readonly boardId: BoardId;
  readonly title: string;
  /** Карточек сущности на доске. */
  readonly placements: number;
  /** Элементов, в тексте которых она упомянута. */
  readonly mentions: number;
}

export interface EntityUsage {
  readonly boards: readonly BoardUsage[];
  /** Сущности, в длинных текстах которых она упомянута. */
  readonly mentionedIn: readonly string[];
}

/** Сколько раз доска ссылается на каждую сущность. */
export function scanBoard(doc: Y.Doc): Map<string, { placements: number; mentions: number }> {
  const result = new Map<string, { placements: number; mentions: number }>();
  const entry = (id: string) => {
    const existing = result.get(id) ?? { placements: 0, mentions: 0 };
    result.set(id, existing);
    return existing;
  };
  for (const element of readElements(doc).items) {
    if (element.deletedAt !== null) continue;
    const entityId = definitionFor(element.type).entityOf(element.data);
    if (entityId !== null) entry(entityId).placements += 1;
    const text = textOf(doc, element.id);
    if (text === null) continue;
    for (const id of mentionedIds(fragmentToRich(text))) entry(id).mentions += 1;
  }
  return result;
}

/** Сущности, в текстах полей которых упомянута данная. */
export function mentionsInEntities(projectDoc: Y.Doc, entityId: string): string[] {
  return readEntities(projectDoc)
    .items.filter((entity) => entity.deletedAt === null && entity.id !== entityId)
    .filter((entity) =>
      entityTexts(projectDoc, entity.id).some((text) =>
        mentionedIds(fragmentToRich(text)).has(entityId),
      ),
    )
    .map((entity) => entity.id);
}

const liveBoards = (doc: Y.Doc): Board[] =>
  readBoards(doc).items.filter((board) => board.deletedAt === null);

async function scanProjectBoard(project: OpenProject, board: Board) {
  const wasOpen = project.openBoardIds().includes(board.id);
  const stored = await project.openBoard(board.id);
  const counts = scanBoard(stored.doc);
  if (!wasOpen) await project.closeBoard(board.id);
  return counts;
}

export async function findEntityUsage(
  project: OpenProject,
  entityId: string,
): Promise<EntityUsage> {
  const boards: BoardUsage[] = [];
  for (const board of liveBoards(project.projectDoc.doc)) {
    const counts = (await scanProjectBoard(project, board)).get(entityId);
    if (counts !== undefined) boards.push({ boardId: board.id, title: board.title, ...counts });
  }
  return { boards, mentionedIn: mentionsInEntities(project.projectDoc.doc, entityId) };
}
