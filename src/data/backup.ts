import * as Y from 'yjs';
import { z } from 'zod';
import {
  ProjectMetaSchema,
  TimestampSchema,
  err,
  ok,
  validate,
  type FileSystem,
  type ProjectMeta,
  type Result,
  type Timestamp,
} from '../core';
import { decodeFrames, encodeFrame } from './logFormat';
import type { OpenProject } from './project';
import { PROJECT_FILE } from './projectMeta';
import { PROJECT_DOC_ID, readBoards } from './projectDocument';

/**
 * Резервные копии (ТЗ, раздел 8): раз в сутки полное состояние проекта со всех устройств — в один
 * файл в папке приложения, вне синхронизации. Хранятся последние 14.
 *
 * Файл — кадры журнала (logFormat): заголовок JSON, затем пары «id документа — состояние Yjs».
 */

export const BACKUP_KEEP = 14;
const EXTENSION = '.doskabackup';

const BackupHeaderSchema = z.object({
  kind: z.literal('doska-backup'),
  version: z.literal(1),
  createdAt: TimestampSchema,
  meta: ProjectMetaSchema,
  docs: z.array(z.string()),
});

const encoder = new TextEncoder();
const decoder = new TextDecoder();

/** Имя файла копии за день (UTC): 2026-10-31.doskabackup — сортируется по дате как строка. */
export function backupFileName(now: Timestamp): string {
  return `${new Date(now).toISOString().slice(0, 10)}${EXTENSION}`;
}

/** Состояние всех досок (включая лежащие в корзине); закрытые доски открываются и закрываются. */
async function collectDocuments(project: OpenProject): Promise<[string, Uint8Array][]> {
  const documents: [string, Uint8Array][] = [
    [PROJECT_DOC_ID, Y.encodeStateAsUpdate(project.projectDoc.doc)],
  ];
  for (const board of readBoards(project.projectDoc.doc).items) {
    const wasOpen = project.openBoardIds().includes(board.id);
    const stored = await project.openBoard(board.id);
    documents.push([board.id, Y.encodeStateAsUpdate(stored.doc)]);
    if (!wasOpen) await project.closeBoard(board.id);
  }
  return documents;
}

export async function writeBackup(
  project: OpenProject,
  backupFs: FileSystem,
  now: Timestamp,
): Promise<string> {
  const documents = await collectDocuments(project);
  const header = {
    kind: 'doska-backup',
    version: 1,
    createdAt: now,
    meta: project.meta,
    docs: documents.map(([id]) => id),
  };
  const frames = [encodeFrame(encoder.encode(JSON.stringify(header)))];
  for (const [id, state] of documents)
    frames.push(encodeFrame(encoder.encode(id)), encodeFrame(state));
  const data = new Uint8Array(frames.reduce((sum, frame) => sum + frame.length, 0));
  let offset = 0;
  for (const frame of frames) {
    data.set(frame, offset);
    offset += frame.length;
  }
  const path = `${project.meta.id}/${backupFileName(now)}`;
  await backupFs.writeFileAtomic(path, data);
  return path;
}

/** Оставляет только последние keep копий проекта; возвращает удалённые пути. */
export async function pruneBackups(
  backupFs: FileSystem,
  projectId: string,
  keep = BACKUP_KEEP,
): Promise<string[]> {
  const names = (await backupFs.listDir(projectId))
    .filter((name) => name.endsWith(EXTENSION))
    .sort();
  const removed = names
    .slice(0, Math.max(0, names.length - keep))
    .map((name) => `${projectId}/${name}`);
  for (const path of removed) await backupFs.removeFile(path);
  return removed;
}

/** Делает копию, если сегодня её ещё не было, и убирает старые. */
export async function ensureDailyBackup(
  project: OpenProject,
  backupFs: FileSystem,
  now: Timestamp,
): Promise<boolean> {
  const existing = await backupFs.listDir(project.meta.id);
  if (existing.includes(backupFileName(now))) return false;
  await writeBackup(project, backupFs, now);
  await pruneBackups(backupFs, project.meta.id);
  return true;
}

export interface ParsedBackup {
  readonly createdAt: Timestamp;
  readonly meta: ProjectMeta;
  readonly documents: ReadonlyMap<string, Uint8Array>;
}

export function parseBackup(data: Uint8Array): Result<ParsedBackup> {
  const { frames, corruptTail } = decodeFrames(data);
  if (corruptTail) return err('Файл резервной копии повреждён');
  const [headerFrame, ...rest] = frames;
  if (headerFrame === undefined) return err('Файл резервной копии пуст');
  let json: unknown;
  try {
    json = JSON.parse(decoder.decode(headerFrame));
  } catch {
    return err('Это не резервная копия «Доски»');
  }
  const header = validate(BackupHeaderSchema, json);
  if (!header.ok) return err(`Это не резервная копия «Доски»: ${header.error}`);
  const documents = new Map<string, Uint8Array>();
  for (let index = 0; index + 1 < rest.length; index += 2) {
    const id = rest[index];
    const state = rest[index + 1];
    if (id !== undefined && state !== undefined) documents.set(decoder.decode(id), state);
  }
  if (header.value.docs.some((id) => !documents.has(id)))
    return err('В резервной копии не хватает документов');
  return ok({ createdAt: header.value.createdAt, meta: header.value.meta, documents });
}

/** Восстанавливает копию в пустую папку как снимки этого устройства. */
export async function restoreBackup(
  data: Uint8Array,
  targetFs: FileSystem,
  deviceId: string,
): Promise<Result<ProjectMeta>> {
  const backup = parseBackup(data);
  if (!backup.ok) return backup;
  if ((await targetFs.readFile(PROJECT_FILE)) !== null)
    return err('Восстанавливать можно только в пустую папку');
  await targetFs.writeFileAtomic(
    PROJECT_FILE,
    encoder.encode(JSON.stringify(backup.value.meta, null, 2)),
  );
  for (const [id, state] of backup.value.documents) {
    await targetFs.writeFileAtomic(`data/${deviceId}/${id}.snapshot`, encodeFrame(state));
  }
  return ok(backup.value.meta);
}
