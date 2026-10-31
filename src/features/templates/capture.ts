import type * as Y from 'yjs';
import {
  compareStacking,
  fieldsOf,
  optionsOf,
  resolveTag,
  tagIdsOf,
  type Board,
  type BoardElement,
  type BoardId,
  type EntityType,
  type Tag,
  type Template,
  type TemplateBoard,
  type TemplateElement,
  type TemplateEntityType,
} from '../../core';
import {
  fragmentToRich,
  readBoards,
  readConnections,
  readElements,
  readEntities,
  readEntityTypes,
  readTags,
  textOf,
  type OpenProject,
} from '../../data';
import { definitionFor, fieldName, optionName, typeName } from '../../elements';

/** Доска с вложенными → шаблон (ADR 0006). Карточки сущностей не берутся — только их типы. */
interface Capturing {
  readonly project: OpenProject;
  readonly boards: readonly Board[];
  readonly tags: ReadonlyMap<string, Tag>;
  readonly entityTypes: Set<string>;
}

/** Контейнеры раньше своих карточек: номер колонки в шаблоне меньше номера карточки. */
function ordered(elements: readonly BoardElement[]): BoardElement[] {
  const live = elements.filter((element) => element.deletedAt === null);
  const top = live.filter((element) => element.parentId === null).sort(compareStacking);
  const inside = live.filter((element) => element.parentId !== null).sort(compareStacking);
  return [...top, ...inside];
}

function tagNames(capturing: Capturing, element: BoardElement): string[] {
  return tagIdsOf(element.tags).flatMap((id) => resolveTag(id, capturing.tags)?.name ?? []);
}

/** Элементы доски → элементы шаблона; карточки досок вне шаблона и сущностей пропускаются. */
function captureElements(
  capturing: Capturing,
  doc: Y.Doc,
  childIndex: ReadonlyMap<string, number>,
): { elements: TemplateElement[]; indexOf: Map<string, number> } {
  const entityTypeOf = new Map(
    readEntities(capturing.project.projectDoc.doc).items.map((entity) => [
      entity.id as string,
      entity.typeId,
    ]),
  );
  const indexOf = new Map<string, number>();
  const elements: TemplateElement[] = [];
  for (const element of ordered(readElements(doc).items)) {
    const definition = definitionFor(element.type);
    const entity = definition.entityOf(element.data);
    if (entity !== null) {
      const typeId = entityTypeOf.get(entity);
      if (typeId !== undefined) capturing.entityTypes.add(typeId);
      continue;
    }
    const target = definition.target(element);
    const child = target?.kind === 'board' ? childIndex.get(target.id) : undefined;
    const parentIndex = element.parentId === null ? undefined : indexOf.get(element.parentId);
    if (
      (target?.kind === 'board' && child === undefined) ||
      (element.parentId !== null && parentIndex === undefined)
    )
      continue;
    const text = textOf(doc, element.id);
    const tags = tagNames(capturing, element);
    indexOf.set(element.id, elements.length);
    elements.push({
      type: element.type,
      x: element.x,
      y: element.y,
      width: element.width,
      height: element.height,
      color: element.color,
      ...(child === undefined ? { data: element.data } : { board: child }),
      ...(text === null ? {} : { richText: fragmentToRich(text) }),
      ...(parentIndex === undefined ? {} : { parentIndex }),
      ...(tags.length === 0 ? {} : { tags }),
    });
  }
  return { elements, indexOf };
}

function captureConnections(doc: Y.Doc, indexOf: ReadonlyMap<string, number>) {
  return readConnections(doc).items.flatMap((connection) => {
    if (
      connection.deletedAt !== null ||
      connection.from.kind !== 'element' ||
      connection.to.kind !== 'element'
    )
      return [];
    const from = indexOf.get(connection.from.elementId);
    const to = indexOf.get(connection.to.elementId);
    return from === undefined || to === undefined
      ? []
      : [{ from, to, label: connection.label, lineStyle: connection.lineStyle }];
  });
}

async function captureBoard(capturing: Capturing, board: Board): Promise<TemplateBoard> {
  const { project } = capturing;
  const children = capturing.boards
    .filter((item) => item.parentId === board.id && item.deletedAt === null)
    .sort((a, b) => a.createdAt - b.createdAt);
  const childIndex = new Map(children.map((child, index) => [child.id as string, index]));
  const wasOpen = project.openBoardIds().includes(board.id);
  const { doc } = await project.openBoard(board.id);
  const { elements, indexOf } = captureElements(capturing, doc, childIndex);
  const connections = captureConnections(doc, indexOf);
  if (!wasOpen) await project.closeBoard(board.id);
  const nested: TemplateBoard[] = [];
  for (const child of children) nested.push(await captureBoard(capturing, child));
  return {
    title: board.title,
    background: board.background,
    elements,
    connections,
    children: nested,
  };
}

/** Типы сущностей шаблона; встроенные — ссылкой на встроенный тип проекта. */
function templateTypes(types: readonly EntityType[]): TemplateEntityType[] {
  const keyOf = (type: EntityType) => type.builtin ?? type.id;
  const included = new Map(types.map((type) => [type.id as string, keyOf(type)]));
  return types.map((type) => ({
    key: keyOf(type),
    ...(type.builtin === null ? {} : { builtin: type.builtin }),
    name: typeName(type),
    icon: type.icon,
    color: type.color,
    fields:
      type.builtin !== null
        ? []
        : fieldsOf(type).map((field) => ({
            name: fieldName(field),
            kind: field.kind,
            onCard: field.onCard,
            ...(field.kind === 'select' || field.kind === 'multiSelect'
              ? { options: optionsOf(field).map(optionName) }
              : {}),
            ...(field.target === undefined || field.target === null || !included.has(field.target)
              ? {}
              : { target: included.get(field.target) ?? '' }),
            ...(field.multiple === undefined ? {} : { multiple: field.multiple }),
            ...(field.backName === undefined || field.backName === ''
              ? {}
              : { backName: field.backName }),
          })),
  }));
}

export async function captureTemplate(
  project: OpenProject,
  boardId: BoardId,
  meta: { readonly id: string; readonly name: string; readonly description: string },
): Promise<Template | null> {
  const projectDoc = project.projectDoc.doc;
  const boards = readBoards(projectDoc).items;
  const board = boards.find((item) => item.id === boardId);
  if (board === undefined) return null;
  const capturing: Capturing = {
    project,
    boards,
    tags: new Map(readTags(projectDoc).items.map((tag) => [tag.id as string, tag])),
    entityTypes: new Set(),
  };
  const captured = await captureBoard(capturing, board);
  const types = readEntityTypes(projectDoc).items.filter((type) =>
    capturing.entityTypes.has(type.id),
  );
  return {
    app: 'doska',
    kind: 'template',
    version: 1,
    id: meta.id,
    scope: 'board',
    name: meta.name,
    description: meta.description,
    board: captured,
    entityTypes: templateTypes(types),
  };
}
