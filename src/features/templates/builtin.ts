import { z } from 'zod';
import { TemplateSchema, validate, type Template, type TemplateBoard } from '../../core';
import { builtinTemplatesSource } from '../../i18n';

/**
 * Встроенные шаблоны из перевода. В шаблонах проектов доска может ссылаться на шаблон доски
 * (`use`) — чтобы не повторять одно и то же содержимое.
 */
const SourceSchema = z.object({
  boards: z.array(z.record(z.string(), z.unknown())),
  projects: z.array(z.record(z.string(), z.unknown())),
});

function resolveUses(board: unknown, boards: ReadonlyMap<string, TemplateBoard>): unknown {
  if (typeof board !== 'object' || board === null) return board;
  const record = board as Record<string, unknown>; // проверено выше; итог проверит TemplateSchema
  const used = typeof record.use === 'string' ? boards.get(record.use) : undefined;
  if (used !== undefined) return { ...used, title: record.title ?? used.title };
  const children = Array.isArray(record.children)
    ? record.children.map((child: unknown) => resolveUses(child, boards))
    : undefined;
  return children === undefined ? record : { ...record, children };
}

function parse(raw: Record<string, unknown>, scope: Template['scope']): Template | null {
  const checked = validate(TemplateSchema, {
    app: 'doska',
    kind: 'template',
    version: 1,
    scope,
    ...raw,
  });
  if (checked.ok) return checked.value;
  console.error('Встроенный шаблон испорчен', raw.id, checked.error);
  return null;
}

let cache: { readonly boards: readonly Template[]; readonly projects: readonly Template[] } | null =
  null;

export function builtinTemplates(): {
  readonly boards: readonly Template[];
  readonly projects: readonly Template[];
} {
  if (cache !== null) return cache;
  const source = SourceSchema.safeParse(builtinTemplatesSource());
  if (!source.success) return { boards: [], projects: [] };
  const boards = source.data.boards.flatMap((raw) => parse(raw, 'board') ?? []);
  const byId = new Map<string, TemplateBoard>(
    boards.map((template) => [template.id, template.board]),
  );
  const projects = source.data.projects.flatMap(
    (raw) => parse({ ...raw, board: resolveUses(raw.board, byId) }, 'project') ?? [],
  );
  cache = { boards, projects };
  return cache;
}
