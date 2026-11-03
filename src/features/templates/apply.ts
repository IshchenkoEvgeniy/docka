import {
  err,
  ok,
  plainToRichText,
  type BoardId,
  type CommandEnvironment,
  type ElementId,
  type NewElement,
  type ProjectCommand,
  type Result,
  type Template,
  type TemplateBoard,
  type TemplateElement,
  type TagId,
} from '../../core';
import { executeBoardCommand, executeProjectCommand, readTags, type OpenProject } from '../../data';
import { definitionFor } from '../../elements';
import { ensureEntityTypes } from './entityTypes';

/**
 * Шаблон → доски проекта (ADR 0006). Доски создаются вложенными, элементы — пачкой на доску
 * (один шаг отмены), стрелки — между ними, теги — по именам (недостающие создаются).
 */
interface Applying {
  readonly project: OpenProject;
  readonly environment: CommandEnvironment;
  readonly tags: Map<string, TagId>;
}

const runProject = (applying: Applying, command: ProjectCommand) =>
  executeProjectCommand(applying.project.projectDoc.doc, command, applying.environment);

function tagId(applying: Applying, name: string): TagId | null {
  const known = applying.tags.get(name.toLocaleLowerCase());
  if (known !== undefined) return known;
  const created = runProject(applying, { kind: 'createTag', name, color: 'default' });
  const id = readTags(applying.project.projectDoc.doc).items.find(
    (tag) => tag.id === (created.ok ? created.value.createdId : null),
  )?.id;
  if (id !== undefined) applying.tags.set(name.toLocaleLowerCase(), id);
  return id ?? null;
}

function newElement(
  applying: Applying,
  element: TemplateElement,
  childIds: readonly BoardId[],
): NewElement {
  const definition = definitionFor(element.type);
  const target = element.board === undefined ? undefined : childIds[element.board];
  const data =
    target === undefined
      ? (element.data ?? {})
      : (definition.withTarget(element.data ?? {}, target) ?? {});
  const richText =
    element.richText ?? (element.text === undefined ? undefined : plainToRichText(element.text));
  return {
    type: element.type,
    placement: { x: element.x, y: element.y, width: element.width, height: element.height },
    color: element.color ?? 'default',
    data,
    tagIds: (element.tags ?? []).flatMap((name) => tagId(applying, name) ?? []),
    ...(definition.richText && richText !== undefined ? { richText } : {}),
    ...(element.parentIndex === undefined ? {} : { parentIndex: element.parentIndex }),
    ...(element.mindMap === undefined ? {} : { mindMap: element.mindMap }),
  };
}

async function fillBoard(
  applying: Applying,
  boardId: BoardId,
  board: TemplateBoard,
  childIds: readonly BoardId[],
): Promise<Result<BoardId>> {
  const stored = await applying.project.openBoard(boardId);
  const run = (command: Parameters<typeof executeBoardCommand>[2]) =>
    executeBoardCommand(stored.doc, boardId, command, applying.environment);
  const elements = board.elements.map((item) => newElement(applying, item, childIds));
  if (elements.length === 0) return ok(boardId);
  const created = run({ kind: 'createElements', elements });
  if (!created.ok) return created;
  // createElements отдаёт id в том же порядке, что и элементы шаблона.
  const ids = (created.value.createdIds ?? []) as readonly ElementId[];
  for (const connection of board.connections ?? []) {
    const from = ids[connection.from];
    const to = ids[connection.to];
    if (from === undefined || to === undefined) continue;
    run({
      kind: 'createConnection',
      from: { kind: 'element', elementId: from, side: 'auto' },
      to: { kind: 'element', elementId: to, side: 'auto' },
      style: {
        label: connection.label ?? '',
        ...(connection.lineStyle === undefined ? {} : { lineStyle: connection.lineStyle }),
      },
    });
  }
  return ok(boardId);
}

async function applyBoard(
  applying: Applying,
  board: TemplateBoard,
  target: BoardId | { readonly parentId: BoardId },
): Promise<Result<BoardId>> {
  let boardId: BoardId;
  if (typeof target === 'string') boardId = target;
  else {
    const created = runProject(applying, {
      kind: 'createBoard',
      parentId: target.parentId,
      title: board.title,
    });
    if (!created.ok || created.value.createdId === undefined)
      return err(created.ok ? 'Доска не создана' : created.error);
    boardId = created.value.createdId as BoardId; // createBoard отдаёт id доски
  }
  if (board.background !== undefined)
    runProject(applying, {
      kind: 'updateBoard',
      boardId,
      changes: { background: board.background },
    });
  const childIds: BoardId[] = [];
  for (const child of board.children ?? []) {
    const applied = await applyBoard(applying, child, { parentId: boardId });
    if (!applied.ok) return applied;
    childIds.push(applied.value);
  }
  return fillBoard(applying, boardId, board, childIds);
}

/**
 * Применяет шаблон: into — новая доска внутри этой (шаблон доски) или сама доска (шаблон
 * проекта ложится в корень нового проекта). Возвращает id доски шаблона.
 */
export async function applyTemplate(
  project: OpenProject,
  environment: CommandEnvironment,
  template: Template,
  into: { readonly parentId: BoardId } | { readonly boardId: BoardId },
): Promise<Result<BoardId>> {
  const doc = project.projectDoc.doc;
  ensureEntityTypes(doc, environment, template.entityTypes);
  const tags = new Map(readTags(doc).items.map((tag) => [tag.name.toLocaleLowerCase(), tag.id]));
  const applying = { project, environment, tags };
  return applyBoard(applying, template.board, 'boardId' in into ? into.boardId : into);
}
