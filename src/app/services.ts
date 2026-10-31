import {
  createMemoryFileSystem,
  createRandomIdGenerator,
  scopedFileSystem,
  systemClock,
  type FileSystem,
  type IdGenerator,
} from '../core';
import { createProjectIn, executeBoardCommand } from '../data';
import type { AppServices, OpenedFolder } from '../features';
import {
  androidStorage,
  createTauriFileSystem,
  createTauriFolderWatcher,
  isMobileDevice,
  isTauriRuntime,
  onShared,
  openAppFolder,
  openProjectFolder,
  pickFolder,
  takeSharedItems,
  tauriBridge,
} from '../platform';
import { sampleElements } from './dev/devBoard';

/** Первая часть запуска: папка настроек; вторая — папка проектов из настроек. */
export interface Platform {
  readonly settingsFs: FileSystem;
  readonly ids: IdGenerator;
  readonly deviceKind: 'desktop' | 'mobile';
  readonly complete: (projectsFolder: string | null) => Promise<AppServices>;
}

const restart = (): void => {
  window.location.reload();
};

async function openProjects(custom: string | null) {
  if (custom !== null) {
    try {
      return { root: await openProjectFolder(custom, tauriBridge, true), error: null };
    } catch (error: unknown) {
      return { root: await openAppFolder('projects'), error: String(error) };
    }
  }
  return { root: await openAppFolder('projects'), error: null };
}

async function openTauriFolder(path: string): Promise<OpenedFolder> {
  const root = await openProjectFolder(path);
  return { path: root, fs: createTauriFileSystem(root), watcher: createTauriFolderWatcher(root) };
}

async function createTauriPlatform(): Promise<Platform> {
  const settings = await openAppFolder('settings');
  const ids = createRandomIdGenerator();
  const deviceKind = isMobileDevice() ? 'mobile' : 'desktop';
  return {
    settingsFs: createTauriFileSystem(settings),
    ids,
    deviceKind,
    complete: async (projectsFolder) => {
      const [projects, backups] = await Promise.all([
        openProjects(projectsFolder),
        openAppFolder('backups'),
      ]);
      return {
        settingsFs: createTauriFileSystem(settings),
        projectsFs: createTauriFileSystem(projects.root),
        projectsFolderLabel: projects.root,
        projectsFolderError: projects.error,
        backupsFs: createTauriFileSystem(backups),
        projectsWatcher: createTauriFolderWatcher(projects.root),
        clock: systemClock,
        ids,
        deviceKind,
        openFolder: openTauriFolder,
        pickFolder: deviceKind === 'desktop' ? pickFolder : null,
        storage: androidStorage(),
        takeShared: takeSharedItems,
        onShared,
        restart,
      };
    },
  };
}

/** Пример проекта для запуска в обычном браузере: есть что подвигать сразу. */
async function seedExample(fs: FileSystem, ids: IdGenerator) {
  const context = { deviceId: 'browser-device', clock: systemClock, ids };
  const created = await createProjectIn(fs, context, 'Пример');
  if (!created.ok) return;
  const { project } = created.value;
  const rootId = project.meta.rootBoardId;
  const board = await project.openBoard(rootId);
  executeBoardCommand(
    board.doc,
    rootId,
    { kind: 'createElements', elements: sampleElements() },
    context,
  );
  await project.close();
}

/**
 * «Диск» браузерного режима: папки вне папки проектов живут в памяти, путь вводится в prompt.
 * Нужен, чтобы проверять проекты в разных папках без Tauri.
 */
function browserDisk(): Pick<AppServices, 'openFolder' | 'pickFolder'> {
  const disk = createMemoryFileSystem();
  return {
    openFolder: (path) => {
      const relative = path.replace(/^[\\/]+|[\\/]+$/g, '').replace(/\\/g, '/');
      return Promise.resolve({ path, fs: scopedFileSystem(disk, relative), watcher: null });
    },
    pickFolder: (title) => Promise.resolve(window.prompt(title, '/Игры')),
  };
}

/**
 * Режим разработки в браузере (`pnpm dev` без Tauri, e2e-проверки): всё в памяти,
 * после перезагрузки страницы — заново.
 */
function createBrowserPlatform(): Platform {
  const settingsFs = createMemoryFileSystem();
  const ids = createRandomIdGenerator();
  const deviceKind = isMobileDevice() ? 'mobile' : 'desktop';
  return {
    settingsFs,
    ids,
    deviceKind,
    complete: async () => {
      const projectsFs = createMemoryFileSystem();
      await seedExample(projectsFs, ids);
      return {
        settingsFs,
        projectsFs,
        projectsFolderLabel: 'память браузера',
        projectsFolderError: null,
        backupsFs: null,
        projectsWatcher: null,
        clock: systemClock,
        ids,
        deviceKind,
        ...browserDisk(),
        storage: null,
        takeShared: () => [],
        onShared: () => () => undefined,
        restart,
      };
    },
  };
}

export function createPlatform(): Promise<Platform> {
  return isTauriRuntime() ? createTauriPlatform() : Promise.resolve(createBrowserPlatform());
}
