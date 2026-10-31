import type * as Y from 'yjs';
import {
  TAG_SEPARATOR,
  TagSchema,
  err,
  normalizeTagName,
  ok,
  resolveTag,
  type CommandResult,
  type ProjectCommand,
  type Result,
  type Tag,
} from '../../core';
import { readTags } from '../projectDocument';
import { commit, prepareRecordPatch } from './recordPatch';

/** Теги проекта (ADR 0006): переименование с вложенными, слияние, скрытие шаблонов. */

type Command<K extends ProjectCommand['kind']> = Extract<ProjectCommand, { kind: K }>;

const tagsOf = (doc: Y.Doc) => doc.getMap<unknown>('tags');
export const REMOVED_TEMPLATES_MAP = 'removedTemplates';

function patchTag(doc: Y.Doc, tag: Tag, changes: Record<string, unknown>) {
  return prepareRecordPatch(tagsOf(doc), tag.id, TagSchema, changes, 'Тег не найден');
}

/** Новое имя тега и его вложенных: «баг» → «ошибка» даёт «баг/x» → «ошибка/x». */
export function updateTag(doc: Y.Doc, command: Command<'updateTag'>): Result<CommandResult> {
  const tags = readTags(doc).items;
  const tag = tags.find((item) => item.id === command.tagId);
  if (tag === undefined) return err('Тег не найден');
  const name =
    command.changes.name === undefined ? undefined : normalizeTagName(command.changes.name);
  if (name === '') return err('У тега должно быть название');
  const writes: (() => void)[] = [];
  const own = patchTag(doc, tag, { ...command.changes, ...(name === undefined ? {} : { name }) });
  if (!own.ok) return own;
  writes.push(own.value);
  if (name !== undefined && name !== tag.name) {
    const prefix = `${tag.name}${TAG_SEPARATOR}`;
    for (const child of tags.filter((item) => item.name.startsWith(prefix))) {
      const renamed = patchTag(doc, child, {
        name: `${name}${TAG_SEPARATOR}${child.name.slice(prefix.length)}`,
      });
      if (!renamed.ok) return renamed;
      writes.push(renamed.value);
    }
  }
  commit(doc, writes);
  return ok({});
}

/** Слияние: tagId скрывается, ссылки на него ведут к intoId. Цикл слияний не допускается. */
export function mergeTags(doc: Y.Doc, command: Command<'mergeTags'>): Result<CommandResult> {
  const byId = new Map(readTags(doc).items.map((tag) => [tag.id as string, tag]));
  const tag = byId.get(command.tagId);
  const into = resolveTag(command.intoId, byId);
  if (tag === undefined || into === null) return err('Тег не найден');
  if (into.id === tag.id) return err('Тег нельзя слить с самим собой');
  const prepared = patchTag(doc, tag, { mergedInto: into.id });
  if (!prepared.ok) return prepared;
  commit(doc, [prepared.value]);
  return ok({});
}

export function removeTemplate(
  doc: Y.Doc,
  command: Command<'removeTemplate'>,
  now: number,
): Result<CommandResult> {
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(command.templateId)) return err('Шаблон не найден');
  commit(doc, [() => doc.getMap<unknown>(REMOVED_TEMPLATES_MAP).set(command.templateId, now)]);
  return ok({});
}
