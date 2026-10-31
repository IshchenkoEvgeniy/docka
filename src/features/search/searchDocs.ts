import type * as Y from 'yjs';
import {
  fieldValue,
  fieldsOf,
  isBoardInTrash,
  optionsOf,
  richTextToPlain,
  selectedIds,
  tagIdsOf,
  taggedIds,
  type BoardId,
  type Entity,
  type EntityType,
  type RichNode,
} from '../../core';
import {
  entityTexts,
  fragmentToRich,
  readBoards,
  readElements,
  readEntities,
  readEntityTypes,
  textOf,
} from '../../data';
import { definitionFor, entityName, optionName, typeName } from '../../elements';

/** Запись индекса поиска: доска, сущность или элемент доски (ADR 0006). */
export interface SearchDoc {
  readonly id: string;
  readonly kind: 'board' | 'entity' | 'element';
  /** Доска, где лежит элемент (у доски — она сама); null у сущности. */
  readonly boardId: string | null;
  /** Что открыть: id доски, сущности или элемента. */
  readonly targetId: string;
  readonly title: string;
  readonly text: string;
  /** Тип элемента; у доски — 'board', у сущности — id её типа. */
  readonly type: string;
  readonly tags: readonly string[];
  readonly updatedAt: number;
  readonly openTasks: number;
}

const TITLE_LENGTH = 80;

function firstLine(text: string): string {
  const line = text.split('\n').find((item) => item.trim() !== '') ?? '';
  return line.length > TITLE_LENGTH ? `${line.slice(0, TITLE_LENGTH)}…` : line;
}

const unique = (ids: Iterable<string>) => [...new Set(ids)];

/** Элементы доски (без корзины): текст — то, что тип отдаёт простым текстом. */
export function elementDocs(doc: Y.Doc, boardId: string): SearchDoc[] {
  return readElements(doc)
    .items.filter((element) => element.deletedAt === null)
    .flatMap((element): SearchDoc[] => {
      const fragment = textOf(doc, element.id);
      const rich: RichNode[] | null = fragment === null ? null : fragmentToRich(fragment);
      const definition = definitionFor(element.type);
      const text = definition.toPlainText(element, rich);
      const tags = unique([...tagIdsOf(element.tags), ...(rich === null ? [] : taggedIds(rich))]);
      const openTasks = definition.openTasks(element);
      if (text.trim() === '' && tags.length === 0 && openTasks === 0) return [];
      return [
        {
          id: `el:${boardId}:${element.id}`,
          kind: 'element',
          boardId,
          targetId: element.id,
          title: firstLine(text) || definition.label(),
          text,
          type: element.type,
          tags,
          updatedAt: element.updatedAt,
          openTasks,
        },
      ];
    });
}

/** Доски вне корзины (в том числе не лежащие в ней вместе с родителем). */
function liveBoards(projectDoc: Y.Doc) {
  const boards = readBoards(projectDoc).items;
  const byId = new Map(boards.map((board) => [board.id as string, board]));
  return boards.filter(
    (board) =>
      !isBoardInTrash(
        board.id,
        (id) => byId.get(id)?.parentId,
        (id) => byId.get(id)?.deletedAt,
      ),
  );
}

export function liveBoardIds(projectDoc: Y.Doc): BoardId[] {
  return liveBoards(projectDoc).map((board) => board.id);
}

export function boardDocs(projectDoc: Y.Doc): SearchDoc[] {
  return liveBoards(projectDoc).map((board) => ({
    id: `board:${board.id}`,
    kind: 'board' as const,
    boardId: board.id,
    targetId: board.id,
    title: board.title,
    text: '',
    type: 'board',
    tags: tagIdsOf(board.tags),
    updatedAt: board.updatedAt,
    openTasks: 0,
  }));
}

/** Текст полей сущности: значения, варианты, связи и длинные тексты. */
function entityText(entity: Entity, type: EntityType, names: ReadonlyMap<string, Entity>): string {
  return fieldsOf(type)
    .map((field) => {
      if (field.kind === 'select' || field.kind === 'multiSelect') {
        const chosen = new Set(selectedIds(field, entity.values));
        return optionsOf(field)
          .filter((option) => chosen.has(option.id))
          .map(optionName)
          .join(' ');
      }
      if (field.kind === 'relation')
        return selectedIds(field, entity.values)
          .map((id) => names.get(id)?.name ?? '')
          .join(' ');
      const value = fieldValue(field, entity.values);
      return typeof value === 'string' || typeof value === 'number' ? String(value) : '';
    })
    .filter((part) => part !== '')
    .join('\n');
}

export function entityDocs(projectDoc: Y.Doc): SearchDoc[] {
  const types = new Map(readEntityTypes(projectDoc).items.map((type) => [type.id as string, type]));
  const entities = readEntities(projectDoc).items.filter((entity) => entity.deletedAt === null);
  const names = new Map(entities.map((entity) => [entity.id as string, entity]));
  return entities.flatMap((entity): SearchDoc[] => {
    const type = types.get(entity.typeId);
    if (type === undefined) return [];
    const texts = entityTexts(projectDoc, entity.id).map(fragmentToRich);
    const longText = texts.map(richTextToPlain).join('\n');
    return [
      {
        id: `entity:${entity.id}`,
        kind: 'entity',
        boardId: null,
        targetId: entity.id,
        title: entityName(entity.name),
        text: [typeName(type), entityText(entity, type, names), longText].join('\n'),
        type: type.id,
        tags: unique([...tagIdsOf(entity.tags), ...texts.flatMap((rich) => [...taggedIds(rich)])]),
        updatedAt: entity.updatedAt,
        openTasks: 0,
      },
    ];
  });
}
