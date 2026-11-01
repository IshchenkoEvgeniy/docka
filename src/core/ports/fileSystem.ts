/**
 * Порт файловой системы. Пути — относительные от корня проекта, разделитель «/»
 * (например, 'data/pc-1/board-42.log'). Реализации: Tauri (шаг 1.3) и память (тесты).
 */
export interface FileSystem {
  /** Содержимое файла или null, если файла нет. */
  readonly readFile: (path: string) => Promise<Uint8Array | null>;
  /**
   * Записывает файл целиком так, что читатель видит либо старое, либо новое содержимое
   * (временный файл + переименование). Недостающие папки создаются.
   */
  readonly writeFileAtomic: (path: string, data: Uint8Array) => Promise<void>;
  /** Дописывает данные в конец файла (создаёт файл и папки при необходимости). */
  readonly appendFile: (path: string, data: Uint8Array) => Promise<void>;
  /** Имена файлов и папок внутри path (без пути); пустой список, если папки нет. */
  readonly listDir: (path: string) => Promise<string[]>;
  /** Удаляет файл (не папку); отсутствующий файл — не ошибка. */
  readonly removeFile: (path: string) => Promise<void>;
  /** Удаляет подпапку со всем содержимым. Пустой путь (корень) и выход за корень запрещены. */
  readonly removeDirectory: (path: string) => Promise<void>;
  /** Самое позднее время изменения файлов внутри папки (мс), null — файлов нет. */
  readonly latestChange: (path: string) => Promise<number | null>;
}
