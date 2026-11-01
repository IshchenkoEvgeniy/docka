import * as Y from 'yjs';
import type { FileSystem } from '../core';
import { crc32, decodeFrames, encodeFrame } from './logFormat';

/**
 * Хранение одного Yjs-документа (доски или общего документа проекта) в папке проекта (ТЗ, раздел 8):
 *
 *   data/<deviceId>/<docId>.snapshot  — сжатое состояние (один кадр, пишется атомарно)
 *   data/<deviceId>/<docId>.log       — правки после снимка (кадры, только дописывается)
 *
 * Устройство пишет только в свою папку, чужие — читает и сливает через Yjs. Поэтому программа
 * синхронизации (Syncthing) никогда не видит одновременных правок одного файла.
 */

export interface DocumentStoreOptions {
  readonly fs: FileSystem;
  /** Постоянный идентификатор этого устройства: латиница, цифры, дефис. */
  readonly deviceId: string;
  /** Размер своего журнала, после которого он сжимается в снимок. По умолчанию 1 МБ. */
  readonly compactThresholdBytes?: number;
  /**
   * Автосохранение: правки записываются в журнал через столько миллисекунд после последней.
   * Не задано — только явным flush() (удобно в тестах).
   */
  readonly autoFlushMs?: number;
  /** Ошибка автосохранения (диск полон, папка исчезла) — чтобы интерфейс мог её показать. */
  readonly onAutoFlushError?: (error: unknown) => void;
  readonly onSaveState?: (docId: string, state: SaveState) => void;
  readonly onCorruptFiles?: (files: readonly string[]) => void;
}

export type SaveState = 'saved' | 'pending' | 'saving' | 'error';

export interface RefreshReport {
  /** Устройства, чьи файлы были прочитаны. */
  readonly devices: readonly string[];
  /** Файлы с повреждёнными данными (целая часть всё равно применена). */
  readonly corruptFiles: readonly string[];
}

export interface StoredDocument {
  readonly doc: Y.Doc;
  /** Записывает накопленные правки этого устройства в его журнал. */
  readonly flush: () => Promise<void>;
  /** Читает правки других устройств, пришедшие через синхронизацию, и сливает их. */
  readonly refresh: () => Promise<RefreshReport>;
  /** Сжимает свой журнал: всё состояние — в снимок, журнал — пустой. */
  readonly compact: () => Promise<void>;
  /** Отключает запись правок. Несохранённые правки нужно сначала записать через flush(). */
  readonly close: () => void;
}

const DATA_DIR = 'data';
const DEFAULT_COMPACT_THRESHOLD = 1024 * 1024;
const DEVICE_ID_PATTERN = /^[A-Za-z0-9-]+$/;
/** Метка правок, пришедших с диска: их не нужно записывать в свой журнал повторно. */
const FROM_DISK = Symbol('from-disk');

const snapshotPath = (deviceId: string, docId: string) =>
  `${DATA_DIR}/${deviceId}/${docId}.snapshot`;
const logPath = (deviceId: string, docId: string) => `${DATA_DIR}/${deviceId}/${docId}.log`;

interface ReadResult {
  readonly corruptFiles: string[];
  readonly ownLogBytes: number;
  readonly ownLogCorrupt: boolean;
}

/** Последнее применённое содержимое файла: при повторном чтении того же содержимого кадры не разбираются. */
type SeenFiles = Map<string, { readonly checksum: number; readonly corrupt: boolean }>;

/** Применяет к документу все целые кадры файла; возвращает, был ли файл повреждён. */
async function applyFile(
  fs: FileSystem,
  doc: Y.Doc,
  path: string,
  seen: SeenFiles,
): Promise<{ bytes: number; corrupt: boolean }> {
  const data = await fs.readFile(path);
  if (data === null) return { bytes: 0, corrupt: false };
  const checksum = crc32(data);
  const previous = seen.get(path);
  if (previous?.checksum === checksum) return { bytes: data.length, corrupt: previous.corrupt };
  const { frames, corruptTail } = decodeFrames(data);
  let corrupt = corruptTail;
  for (const frame of frames) {
    try {
      Y.applyUpdate(doc, frame, FROM_DISK);
    } catch {
      corrupt = true;
    }
  }
  seen.set(path, { checksum, corrupt });
  return { bytes: data.length, corrupt };
}

/** Читает снимки и журналы перечисленных устройств. */
async function readDevices(
  fs: FileSystem,
  doc: Y.Doc,
  docId: string,
  devices: readonly string[],
  ownDeviceId: string,
  seen: SeenFiles,
): Promise<ReadResult> {
  const corruptFiles: string[] = [];
  let ownLogBytes = 0;
  let ownLogCorrupt = false;
  for (const device of devices) {
    for (const path of [snapshotPath(device, docId), logPath(device, docId)]) {
      const result = await applyFile(fs, doc, path, seen);
      if (result.corrupt) corruptFiles.push(path);
      if (device === ownDeviceId && path === logPath(device, docId)) {
        ownLogBytes = result.bytes;
        ownLogCorrupt = result.corrupt;
      }
    }
  }
  return { corruptFiles, ownLogBytes, ownLogCorrupt };
}

async function listDevices(fs: FileSystem): Promise<string[]> {
  const names = await fs.listDir(DATA_DIR);
  return names.filter((name) => DEVICE_ID_PATTERN.test(name));
}

export async function openDocument(
  options: DocumentStoreOptions,
  docId: string,
): Promise<StoredDocument> {
  const { fs, deviceId } = options;
  if (!DEVICE_ID_PATTERN.test(deviceId))
    throw new Error(`Недопустимый идентификатор устройства: ${deviceId}`);
  const threshold = options.compactThresholdBytes ?? DEFAULT_COMPACT_THRESHOLD;

  const doc = new Y.Doc();
  const seen: SeenFiles = new Map();
  const initial = await readDevices(fs, doc, docId, await listDevices(fs), deviceId, seen);
  if (initial.corruptFiles.length > 0) options.onCorruptFiles?.(initial.corruptFiles);
  const writer = createOwnWriter(
    fs,
    doc,
    deviceId,
    docId,
    threshold,
    initial.ownLogBytes,
    (state) => options.onSaveState?.(docId, state),
  );
  const stopAutoFlush = startAutoFlush(doc, writer.flush, options);

  // Свой журнал с испорченным хвостом нельзя дописывать: новые кадры встали бы после мусора.
  if (initial.ownLogCorrupt) await writer.compact();

  return {
    doc,
    flush: writer.flush,
    compact: writer.compact,
    close: () => {
      stopAutoFlush();
      writer.close();
    },
    refresh: async () => {
      const others = (await listDevices(fs)).filter((device) => device !== deviceId);
      const result = await readDevices(fs, doc, docId, others, deviceId, seen);
      return { devices: others, corruptFiles: result.corruptFiles };
    },
  };
}

/** Запускает flush через autoFlushMs после последней своей правки; возвращает остановку. */
function startAutoFlush(
  doc: Y.Doc,
  flush: () => Promise<void>,
  options: DocumentStoreOptions,
): () => void {
  const delay = options.autoFlushMs;
  if (delay === undefined) return () => undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const onUpdate = (_update: Uint8Array, origin: unknown): void => {
    if (origin === FROM_DISK) return;
    clearTimeout(timer);
    timer = setTimeout(() => {
      flush().catch((error: unknown) => options.onAutoFlushError?.(error));
    }, delay);
  };
  doc.on('update', onUpdate);
  return () => {
    clearTimeout(timer);
    doc.off('update', onUpdate);
  };
}

/** Запись правок своего устройства: копит обновления, пишет их кадрами, сжимает журнал. */
function recoverableQueue(
  reportState: (state: SaveState) => void,
  pending: readonly Uint8Array[],
  failed: (value: boolean) => void,
) {
  let queue: Promise<void> = Promise.resolve();
  return (task: () => Promise<void>): Promise<void> => {
    const run = queue.then(async () => {
      reportState('saving');
      try {
        await task();
        failed(false);
        reportState(pending.length === 0 ? 'saved' : 'pending');
      } catch (error: unknown) {
        failed(true);
        reportState('error');
        throw error;
      }
    });
    // Вызывающий получает ошибку, но следующая попытка не наследует отклонённую очередь.
    queue = run.catch(() => undefined);
    return run;
  };
}

function createOwnWriter(
  fs: FileSystem,
  doc: Y.Doc,
  deviceId: string,
  docId: string,
  threshold: number,
  initialLogBytes: number,
  reportState: (state: SaveState) => void,
) {
  const pending: Uint8Array[] = [];
  let logBytes = initialLogBytes;
  let needsSnapshot = false;
  let failed = false;
  // Записи на диск идут строго по очереди, даже если flush вызван несколько раз подряд.
  const enqueue = recoverableQueue(reportState, pending, (value) => {
    failed = value;
    // Дописывание могло оборваться посреди кадра: повторяем полным атомарным снимком.
    if (value) needsSnapshot = true;
  });

  const detach = collectLocalUpdates(doc, pending, () => {
    reportState(failed ? 'error' : 'pending');
  });

  const writeSnapshot = async (): Promise<void> => {
    const count = pending.length;
    // Сначала снимок, потом пустой журнал: при сбое между ними правки есть в обоих (Yjs не задвоит).
    await fs.writeFileAtomic(
      snapshotPath(deviceId, docId),
      encodeFrame(Y.encodeStateAsUpdate(doc)),
    );
    await fs.writeFileAtomic(logPath(deviceId, docId), new Uint8Array());
    logBytes = 0;
    pending.splice(0, count);
    needsSnapshot = false;
  };

  const appendPending = async (): Promise<void> => {
    if (needsSnapshot) return writeSnapshot();
    if (pending.length === 0) return;
    const count = pending.length;
    const frame = encodeFrame(Y.mergeUpdates(pending));
    await fs.appendFile(logPath(deviceId, docId), frame);
    pending.splice(0, count);
    logBytes += frame.length;
    if (logBytes > threshold) await writeSnapshot();
  };

  return {
    flush: () => enqueue(appendPending),
    compact: () => enqueue(writeSnapshot),
    close: detach,
  };
}

function collectLocalUpdates(doc: Y.Doc, pending: Uint8Array[], changed: () => void): () => void {
  const onUpdate = (update: Uint8Array, origin: unknown): void => {
    if (origin === FROM_DISK) return;
    pending.push(update);
    changed();
  };
  doc.on('update', onUpdate);
  return () => {
    doc.off('update', onUpdate);
  };
}
