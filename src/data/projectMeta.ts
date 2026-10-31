import {
  FORMAT_VERSION,
  ProjectMetaSchema,
  err,
  ok,
  validate,
  type FileSystem,
  type ProjectMeta,
  type Result,
} from '../core';
import { MIGRATIONS, migrateMeta, type Migration } from './migrations';

/** project.json: чтение, проверка и приведение к текущей версии формата. */

export const PROJECT_FILE = 'project.json';
export const NEWER_VERSION = 'Проект создан более новой версией приложения — обновите приложение';

export interface ProjectFormat {
  readonly version: number;
  readonly migrations: readonly Migration[];
}

export const APP_FORMAT: ProjectFormat = { version: FORMAT_VERSION, migrations: MIGRATIONS };

const decoder = new TextDecoder();

function parseJson(raw: Uint8Array): Result<Record<string, unknown>> {
  try {
    const json: unknown = JSON.parse(decoder.decode(raw));
    if (typeof json === 'object' && json !== null && !Array.isArray(json))
      return ok(json as Record<string, unknown>);
  } catch {
    // ниже — общая ошибка
  }
  return err('project.json повреждён: это не JSON-объект');
}

/** Читает project.json, при необходимости приводя его к текущей версии формата. */
export async function loadProjectMeta(
  fs: FileSystem,
  format: ProjectFormat,
): Promise<Result<{ meta: ProjectMeta; upgraded: boolean }>> {
  const raw = await fs.readFile(PROJECT_FILE);
  if (raw === null) return err('В папке нет проекта (не найден project.json)');
  const json = parseJson(raw);
  if (!json.ok) return json;
  const version = json.value.formatVersion;
  if (typeof version !== 'number' || !Number.isInteger(version) || version < 1) {
    return err('project.json повреждён: нет версии формата');
  }
  if (version > format.version) return err(NEWER_VERSION);
  const migrated =
    version < format.version
      ? migrateMeta(json.value, version, format.migrations, format.version)
      : json.value;
  const meta = validate(ProjectMetaSchema, migrated);
  if (!meta.ok) return err(`project.json повреждён: ${meta.error}`);
  return ok({ meta: meta.value, upgraded: version < format.version });
}

/** Читает и проверяет project.json: понятная ошибка вместо падения на чужой или новой версии. */
export async function readProjectMeta(fs: FileSystem): Promise<Result<ProjectMeta>> {
  const loaded = await loadProjectMeta(fs, APP_FORMAT);
  return loaded.ok ? ok(loaded.value.meta) : loaded;
}
