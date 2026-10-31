import {
  BoardIdSchema,
  ProjectMetaSchema,
  err,
  ok,
  validate,
  type BoardId,
  type Clock,
  type FileSystem,
  type IdGenerator,
  type ProjectMeta,
  type Result,
} from '../core';
import {
  openDocument,
  type DocumentStoreOptions,
  type RefreshReport,
  type StoredDocument,
} from './documentStore';
import { checkMigrationChain, migrateDocument } from './migrations';
import {
  APP_FORMAT,
  NEWER_VERSION,
  PROJECT_FILE,
  loadProjectMeta,
  type ProjectFormat,
} from './projectMeta';
import { PROJECT_DOC_ID, insertBoard } from './projectDocument';
import { purgeBoardDocument, purgeEntities, purgeProjectDocument } from './trashPurge';

/**
 * Проект на диске: project.json + документ проекта + документы досок, открываемые по требованию.
 * Файловая раскладка — docs/format.md.
 */

export interface ProjectContext extends Omit<DocumentStoreOptions, 'fs'> {
  readonly fs: FileSystem;
  readonly clock: Clock;
  readonly ids: IdGenerator;
  /** Версия формата и миграции; по умолчанию — приложения. Подменяются только в тестах. */
  readonly format?: ProjectFormat;
}

const formatOf = (context: ProjectContext): ProjectFormat => context.format ?? APP_FORMAT;

export interface OpenProject {
  readonly meta: ProjectMeta;
  readonly projectDoc: StoredDocument;
  /** Документ доски; открывается при первом обращении, дальше берётся из кэша. */
  readonly openBoard: (boardId: BoardId) => Promise<StoredDocument>;
  /** Сохраняет и выгружает документ доски (например, когда её давно не открывали). */
  readonly closeBoard: (boardId: BoardId) => Promise<void>;
  readonly openBoardIds: () => BoardId[];
  /** Записывает несохранённые правки всех открытых документов. */
  readonly flushAll: () => Promise<void>;
  /** Перечитывает правки других устройств во всех открытых документах. */
  readonly refreshAll: () => Promise<RefreshReport[]>;
  /** Сохраняет всё и закрывает проект. */
  readonly close: () => Promise<void>;
}

export const STIGNORE_FILE = '.stignore';
/** Временные файлы атомарной записи не должны синхронизироваться (ADR 0002). */
const STIGNORE_PATTERN = '*.doska-tmp';

const encoder = new TextEncoder();
const decoder = new TextDecoder();

/**
 * .stignore не синхронизируется Syncthing, поэтому каждое устройство само следит,
 * чтобы в нём было исключение временных файлов. Свои строки пользователя сохраняются.
 */
async function ensureStignore(fs: FileSystem): Promise<void> {
  const existing = await fs.readFile(STIGNORE_FILE);
  const text = existing === null ? '' : decoder.decode(existing);
  if (text.split(/\r?\n/).some((line) => line.trim() === STIGNORE_PATTERN)) return;
  const prefix = text === '' || text.endsWith('\n') ? text : `${text}\n`;
  await fs.writeFileAtomic(STIGNORE_FILE, encoder.encode(`${prefix}${STIGNORE_PATTERN}\n`));
}

/** Создаёт новый проект в пустой папке: project.json, корневую доску, .stignore. */
export async function createProject(
  context: ProjectContext,
  name: string,
): Promise<Result<OpenProject>> {
  if ((await context.fs.readFile(PROJECT_FILE)) !== null)
    return err('В этой папке уже есть проект');
  const now = context.clock.now();
  const meta = validate(ProjectMetaSchema, {
    formatVersion: formatOf(context).version,
    id: context.ids.next(),
    name,
    rootBoardId: context.ids.next(),
    createdAt: now,
  });
  if (!meta.ok) return meta;

  await context.fs.writeFileAtomic(
    PROJECT_FILE,
    encoder.encode(JSON.stringify(meta.value, null, 2)),
  );
  const opened = await openWithMeta(context, meta.value);
  if (!opened.ok) return opened;
  const project = opened.value;
  insertBoard(project.projectDoc.doc, {
    id: meta.value.rootBoardId,
    title: meta.value.name,
    parentId: null,
    icon: null,
    color: 'default',
    background: 'dots',
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  });
  await project.projectDoc.flush();
  return ok(project);
}

export async function openProject(context: ProjectContext): Promise<Result<OpenProject>> {
  const format = formatOf(context);
  const chain = checkMigrationChain(format.migrations, format.version);
  if (!chain.ok) return chain;
  const loaded = await loadProjectMeta(context.fs, format);
  if (!loaded.ok) return loaded;
  // Единственный случай, когда project.json переписывается после создания (docs/format.md).
  if (loaded.value.upgraded)
    await context.fs.writeFileAtomic(
      PROJECT_FILE,
      encoder.encode(JSON.stringify(loaded.value.meta, null, 2)),
    );
  return openWithMeta(context, loaded.value.meta);
}

/** Файлы удалённой доски в папке своего устройства (чужие удалит их владелец). */
async function removeOwnBoardFiles(
  context: ProjectContext,
  boardIds: readonly BoardId[],
): Promise<void> {
  for (const boardId of boardIds) {
    await context.fs.removeFile(`data/${context.deviceId}/${boardId}.snapshot`);
    await context.fs.removeFile(`data/${context.deviceId}/${boardId}.log`);
  }
}

/** Документ проекта с очисткой корзины от досок старше 30 дней. */
async function openProjectDocument(context: ProjectContext): Promise<Result<StoredDocument>> {
  const projectDoc = await openDocument(context, PROJECT_DOC_ID);
  const format = formatOf(context);
  if (!migrateDocument(projectDoc.doc, 'project', format.migrations, format.version)) {
    projectDoc.close();
    return err(NEWER_VERSION);
  }
  const purgedBoards = purgeProjectDocument(projectDoc.doc, context.clock.now());
  const purgedEntities = purgeEntities(projectDoc.doc, context.clock.now());
  if (purgedEntities > 0 && purgedBoards.length === 0) await projectDoc.flush();
  if (purgedBoards.length > 0) {
    await projectDoc.flush();
    await removeOwnBoardFiles(context, purgedBoards);
  }
  return ok(projectDoc);
}

/** Открытые документы досок: открываются по требованию, кэшируются, чистят свою корзину. */
function createBoardCache(context: ProjectContext) {
  const boards = new Map<BoardId, Promise<StoredDocument>>();
  return {
    boards,
    open: (boardId: BoardId): Promise<StoredDocument> => {
      // id доски становится именем файла: проверяем ещё раз, даже если он пришёл из типизированного кода.
      if (!BoardIdSchema.safeParse(boardId).success) {
        return Promise.reject(new Error(`Недопустимый id доски: ${boardId}`));
      }
      const cached = boards.get(boardId);
      if (cached !== undefined) return cached;
      const format = formatOf(context);
      const opening = openDocument(context, boardId).then((board) => {
        if (!migrateDocument(board.doc, 'board', format.migrations, format.version)) {
          board.close();
          boards.delete(boardId);
          throw new Error('Доска сохранена более новой версией приложения — обновите приложение');
        }
        purgeBoardDocument(board.doc, context.clock.now());
        return board;
      });
      boards.set(boardId, opening);
      return opening;
    },
    close: async (boardId: BoardId): Promise<void> => {
      const opening = boards.get(boardId);
      if (opening === undefined) return;
      boards.delete(boardId);
      const board = await opening;
      await board.flush();
      board.close();
    },
  };
}

async function openWithMeta(
  context: ProjectContext,
  meta: ProjectMeta,
): Promise<Result<OpenProject>> {
  await ensureStignore(context.fs);
  const opened = await openProjectDocument(context);
  if (!opened.ok) return opened;
  const projectDoc = opened.value;
  const cache = createBoardCache(context);
  const allDocuments = async (): Promise<StoredDocument[]> => [
    projectDoc,
    ...(await Promise.all(cache.boards.values())),
  ];

  return ok({
    meta,
    projectDoc,
    openBoard: cache.open,
    closeBoard: cache.close,
    openBoardIds: () => [...cache.boards.keys()],
    flushAll: async () => {
      await Promise.all((await allDocuments()).map((document) => document.flush()));
    },
    refreshAll: async () =>
      Promise.all((await allDocuments()).map((document) => document.refresh())),
    close: async () => {
      const documents = await allDocuments();
      await Promise.all(documents.map((document) => document.flush()));
      documents.forEach((document) => {
        document.close();
      });
      cache.boards.clear();
    },
  });
}
