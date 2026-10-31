import { systemClock, type Clock } from './clock';
import type { FileSystem } from './fileSystem';

export interface MemoryFileSystem extends FileSystem {
  /** Все файлы: путь → содержимое (копия). Для тестов и имитации синхронизации. */
  readonly snapshot: () => Map<string, Uint8Array>;
  /** Кладёт файл напрямую, как это сделала бы программа синхронизации. */
  readonly putExternal: (path: string, data: Uint8Array) => void;
  /** Пути всех записей, сделанных через порт (для проверки, кто куда пишет). */
  readonly writtenPaths: () => readonly string[];
  /** Пути всех чтений через порт (для проверки, что лишнее не читается). */
  readonly readPaths: () => readonly string[];
}

function concat(a: Uint8Array, b: Uint8Array): Uint8Array {
  const result = new Uint8Array(a.length + b.length);
  result.set(a, 0);
  result.set(b, a.length);
  return result;
}

function under(path: string, filePath: string): boolean {
  return path === '' || filePath.startsWith(`${path}/`);
}

function latestIn(modified: ReadonlyMap<string, number>, path: string): number | null {
  let latest: number | null = null;
  for (const [filePath, time] of modified)
    if (under(path, filePath)) latest = Math.max(latest ?? time, time);
  return latest;
}

/** Файловая система в памяти для тестов: та же семантика, что у реальной. */
export function createMemoryFileSystem(clock: Clock = systemClock): MemoryFileSystem {
  const files = new Map<string, Uint8Array>();
  const modified = new Map<string, number>();
  const written: string[] = [];
  const read: string[] = [];
  const store = (path: string, data: Uint8Array): void => {
    files.set(path, data);
    modified.set(path, clock.now());
  };

  return {
    readFile: (path) => {
      read.push(path);
      return Promise.resolve(files.get(path)?.slice() ?? null);
    },
    writeFileAtomic: (path, data) => {
      store(path, data.slice());
      written.push(path);
      return Promise.resolve();
    },
    appendFile: (path, data) => {
      store(path, concat(files.get(path) ?? new Uint8Array(), data));
      written.push(path);
      return Promise.resolve();
    },
    listDir: (path) => {
      const prefix = path === '' ? '' : `${path}/`;
      const names = new Set<string>();
      for (const filePath of files.keys()) {
        if (!filePath.startsWith(prefix)) continue;
        const name = filePath.slice(prefix.length).split('/')[0];
        if (name !== undefined && name !== '') names.add(name);
      }
      return Promise.resolve([...names].sort());
    },
    removeFile: (path) => {
      files.delete(path);
      modified.delete(path);
      written.push(path);
      return Promise.resolve();
    },
    snapshot: () => new Map([...files].map(([path, data]) => [path, data.slice()])),
    putExternal: (path, data) => {
      store(path, data.slice());
    },
    latestChange: (path) => Promise.resolve(latestIn(modified, path)),
    writtenPaths: () => [...written],
    readPaths: () => [...read],
  };
}
