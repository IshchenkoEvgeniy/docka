import { err, ok, scopedFileSystem, type FileSystem, type ProjectMeta, type Result } from '../core';
import { createProject, type OpenProject, type ProjectContext } from './project';
import { NEWER_VERSION, PROJECT_FILE, readProjectMeta } from './projectMeta';

/** Папка проектов: каждый проект — подпапка «Название.doska» (docs/format.md). */
export const PROJECT_EXTENSION = '.doska';

export type ProjectEntry =
  | {
      readonly status: 'ok';
      readonly folder: string;
      readonly meta: ProjectMeta;
      /** Последнее изменение файлов проекта на этом или другом устройстве (мс). */
      readonly modifiedAt: number | null;
    }
  | {
      /** Новее приложения или повреждён: показывается, но не открывается. */
      readonly status: 'newer' | 'broken';
      readonly folder: string;
      readonly error: string;
      readonly modifiedAt: number | null;
    };

/**
 * Проект по его папке. folder — ключ для списка и избранного: имя подпапки в папке проектов
 * или полный путь проекта в другом месте. null — в папке нет project.json.
 */
export async function readProjectEntry(
  project: FileSystem,
  folder: string,
): Promise<ProjectEntry | null> {
  if ((await project.readFile(PROJECT_FILE)) === null) return null;
  const [meta, modifiedAt] = await Promise.all([
    readProjectMeta(project),
    project.latestChange(''),
  ]);
  if (meta.ok) return { status: 'ok', folder, meta: meta.value, modifiedAt };
  const status = meta.error === NEWER_VERSION ? 'newer' : 'broken';
  return { status, folder, error: meta.error, modifiedAt };
}

/** Новые изменения сверху. */
export function sortProjects(entries: readonly ProjectEntry[]): ProjectEntry[] {
  return [...entries].sort((a, b) => (b.modifiedAt ?? 0) - (a.modifiedAt ?? 0));
}

/** Проекты в папке, новые изменения сверху. Папки без project.json пропускаются. */
export async function listProjects(fs: FileSystem): Promise<ProjectEntry[]> {
  const folders = (await fs.listDir('')).filter((name) => name.endsWith(PROJECT_EXTENSION));
  const entries = await Promise.all(
    folders.map((folder) => readProjectEntry(scopedFileSystem(fs, folder), folder)),
  );
  return sortProjects(entries.filter((entry): entry is ProjectEntry => entry !== null));
}

/** Проект вне папки проектов: ключ — полный путь (в именах подпапок разделителей нет). */
export function isProjectPath(folder: string): boolean {
  return /[\\/]/.test(folder);
}

/** Путь в стиле родительской папки: «C:\\Игры» + «Мир.doska». */
export function joinPath(parent: string, child: string): string {
  const separator = parent.includes('\\') ? '\\' : '/';
  return parent.endsWith(separator) ? `${parent}${child}` : `${parent}${separator}${child}`;
}

/** Одна и та же папка (в Windows регистр букв не важен). */
export function samePath(a: string, b: string): boolean {
  const normalize = (path: string) => {
    const trimmed = path.replace(/[\\/]+$/, '');
    return trimmed.includes('\\') ? trimmed.toLowerCase() : trimmed;
  };
  return normalize(a) === normalize(b);
}

const FORBIDDEN = /[<>:"/\\|?*]/g;
/** Управляющие символы (коды 0–31) в именах файлов недопустимы. */
const withoutControl = (text: string): string =>
  Array.from(text, (char) => ((char.codePointAt(0) ?? 0) < 32 ? ' ' : char)).join('');
const MAX_FOLDER_NAME = 60;

/** Имя папки из названия проекта: допустимое в Windows и Android и не занятое. */
export function projectFolderName(name: string, taken: readonly string[]): string {
  const cleaned = withoutControl(name)
    .replace(FORBIDDEN, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^\.+|\.+$/g, '')
    .slice(0, MAX_FOLDER_NAME)
    .trim();
  const base = cleaned === '' ? 'Проект' : cleaned;
  const used = new Set(taken.map((folder) => folder.toLowerCase()));
  for (let index = 1; ; index += 1) {
    const candidate = `${index === 1 ? base : `${base} ${String(index)}`}${PROJECT_EXTENSION}`;
    if (!used.has(candidate.toLowerCase())) return candidate;
  }
}

/** Создаёт проект в новой подпапке папки проектов. */
export async function createProjectIn(
  fs: FileSystem,
  context: Omit<ProjectContext, 'fs'>,
  name: string,
): Promise<Result<{ folder: string; project: OpenProject }>> {
  const trimmed = name.trim();
  if (trimmed === '') return err('Введите название проекта');
  const folder = projectFolderName(trimmed, await fs.listDir(''));
  const created = await createProject({ ...context, fs: scopedFileSystem(fs, folder) }, trimmed);
  return created.ok ? ok({ folder, project: created.value }) : created;
}
