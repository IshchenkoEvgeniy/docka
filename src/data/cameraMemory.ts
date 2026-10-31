import { z } from 'zod';
import { SavedCameraSchema, type Clock, type FileSystem, type SavedCamera } from '../core';

/**
 * Камеры досок на этом устройстве (cameras.json рядом с настройками, не синхронизируется):
 * на телефоне и компьютере экраны разные, общая камера только мешала бы.
 */
export const CAMERAS_FILE = 'cameras.json';
/** Сколько досок помнить; самые давние забываются. */
export const CAMERAS_KEEP = 300;
const SAVE_DELAY_MS = 1000;

const EntrySchema = SavedCameraSchema.extend({ at: z.number() });
type Entry = z.infer<typeof EntrySchema>;

export interface CameraMemory {
  readonly get: (projectId: string, boardId: string) => SavedCamera | null;
  /** Запоминает камеру; на диск пишется с задержкой, пачкой. */
  readonly set: (projectId: string, boardId: string, camera: SavedCamera) => void;
  readonly flush: () => Promise<void>;
}

const keyOf = (projectId: string, boardId: string) => `${projectId}/${boardId}`;

async function readEntries(fs: FileSystem): Promise<Map<string, Entry>> {
  const raw = await fs.readFile(CAMERAS_FILE);
  const entries = new Map<string, Entry>();
  if (raw === null) return entries;
  try {
    const json: unknown = JSON.parse(new TextDecoder().decode(raw));
    if (typeof json !== 'object' || json === null) return entries;
    for (const [key, value] of Object.entries(json)) {
      const parsed = EntrySchema.safeParse(value);
      if (parsed.success) entries.set(key, parsed.data);
    }
  } catch {
    // Битый файл — просто начинаем заново: это не данные пользователя.
  }
  return entries;
}

export async function loadCameraMemory(fs: FileSystem, clock: Clock): Promise<CameraMemory> {
  const entries = await readEntries(fs);
  let timer: ReturnType<typeof setTimeout> | undefined;
  let dirty = false;
  const flush = async (): Promise<void> => {
    clearTimeout(timer);
    if (!dirty) return;
    dirty = false;
    const kept = [...entries].sort(([, a], [, b]) => b.at - a.at).slice(0, CAMERAS_KEEP);
    entries.clear();
    for (const [key, entry] of kept) entries.set(key, entry);
    const data = new TextEncoder().encode(JSON.stringify(Object.fromEntries(kept)));
    await fs.writeFileAtomic(CAMERAS_FILE, data);
  };
  return {
    get: (projectId, boardId) => {
      const entry = entries.get(keyOf(projectId, boardId));
      return entry === undefined
        ? null
        : { offsetX: entry.offsetX, offsetY: entry.offsetY, zoom: entry.zoom };
    },
    set: (projectId, boardId, camera) => {
      entries.set(keyOf(projectId, boardId), { ...camera, at: clock.now() });
      dirty = true;
      clearTimeout(timer);
      timer = setTimeout(() => {
        flush().catch((error: unknown) => {
          console.error('Камеры досок не сохранились', error);
        });
      }, SAVE_DELAY_MS);
    },
    flush,
  };
}
