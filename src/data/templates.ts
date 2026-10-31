import type * as Y from 'yjs';
import {
  TemplateSchema,
  err,
  ok,
  validate,
  type FileSystem,
  type Result,
  type Template,
} from '../core';
import { REMOVED_TEMPLATES_MAP } from './commands/tagCommands';

/**
 * Свои шаблоны проекта (ADR 0006): `templates/<id>.json` — новый неизменяемый файл, как файлы
 * assets/: конфликтов нет, Syncthing переносит его на другие устройства. «Удалить» — отметка
 * в документе проекта, файл остаётся.
 */
export const TEMPLATES_DIR = 'templates';
const FILE = /^([A-Za-z0-9_-]{8,64})\.json$/;

const encoder = new TextEncoder();
const decoder = new TextDecoder();

export interface TemplateList {
  readonly templates: readonly Template[];
  /** Файлы, не прошедшие проверку (испорчены или из новой версии) — пропущены. */
  readonly invalid: readonly string[];
}

/** Скрытые («удалённые») шаблоны проекта. */
export function removedTemplateIds(projectDoc: Y.Doc): Set<string> {
  return new Set(projectDoc.getMap<unknown>(REMOVED_TEMPLATES_MAP).keys());
}

export async function listTemplates(fs: FileSystem, projectDoc: Y.Doc): Promise<TemplateList> {
  const removed = removedTemplateIds(projectDoc);
  const templates: Template[] = [];
  const invalid: string[] = [];
  for (const name of await fs.listDir(TEMPLATES_DIR)) {
    if (!FILE.test(name)) continue;
    const bytes = await fs.readFile(`${TEMPLATES_DIR}/${name}`);
    if (bytes === null) continue;
    try {
      const parsed = validate(TemplateSchema, JSON.parse(decoder.decode(bytes)));
      if (!parsed.ok) invalid.push(name);
      else if (!removed.has(parsed.value.id)) templates.push(parsed.value);
    } catch {
      invalid.push(name);
    }
  }
  return { templates: templates.sort((a, b) => a.name.localeCompare(b.name)), invalid };
}

/** Новый файл шаблона; существующий не перезаписывается (у каждого шаблона свой id). */
export async function saveTemplate(fs: FileSystem, template: Template): Promise<Result<string>> {
  const checked = validate(TemplateSchema, template);
  if (!checked.ok) return checked;
  const path = `${TEMPLATES_DIR}/${template.id}.json`;
  if ((await fs.readFile(path)) !== null) return err('Шаблон с таким id уже есть');
  await fs.writeFileAtomic(path, encoder.encode(JSON.stringify(checked.value, null, 2)));
  return ok(template.id);
}
