import type {
  ClipboardReader,
  Clock,
  FileSaver,
  FileSystem,
  FolderWatcher,
  IdGenerator,
  Network,
} from '../../core';

/** Получено через «Поделиться → Доска» (Android); файл — в base64. */
export type SharedItem =
  | { readonly kind: 'text'; readonly text: string }
  | {
      readonly kind: 'file';
      readonly name: string;
      readonly mime: string;
      readonly base64: string;
    };

/** Доступ к общей памяти телефона (папка проектов рядом с Syncthing). */
export interface StorageAccess {
  readonly hasAllFilesAccess: () => boolean;
  readonly requestAllFilesAccess: () => void;
  readonly suggestedProjectsFolder: () => string;
}

/** Открытая папка на диске (проект или место для нового проекта). */
export interface OpenedFolder {
  /** Канонический путь — ключ проекта и основа для путей подпапок. */
  readonly path: string;
  readonly fs: FileSystem;
  readonly watcher: FolderWatcher | null;
  /** Открыть файл папки системной программой; null — нельзя на этой платформе. */
  readonly open: ((relativePath: string, mime: string) => Promise<void>) | null;
}

/**
 * Всё платформенное, что нужно сценариям: папки, слежение, время, id, системные окна.
 * Собирает app (Tauri или память в браузере) — сценарии не знают, откуда это.
 */
export interface AppServices {
  readonly readClipboard: ClipboardReader;
  readonly saveFile: FileSaver;
  /** Папка настроек устройства (вне синхронизации). */
  readonly settingsFs: FileSystem;
  /** Папка проектов: подпапки «Название.doska». */
  readonly projectsFs: FileSystem;
  /** Путь папки проектов для показа пользователю. */
  readonly projectsFolderLabel: string;
  /** Своя папка проектов не открылась — работаем в папке по умолчанию; текст причины. */
  readonly projectsFolderError: string | null;
  /** Резервные копии (вне синхронизации); null — недоступны. */
  readonly backupsFs: FileSystem | null;
  /** Слежение за папкой проектов; null — только опрос. */
  readonly projectsWatcher: FolderWatcher | null;
  readonly clock: Clock;
  readonly ids: IdGenerator;
  /** На телефоне папку дополнительно опрашивают: слежение там ненадёжно. */
  readonly deviceKind: 'desktop' | 'mobile';
  /** Открывает папку по полному пути (проект вне папки проектов); null — нельзя на этой платформе. */
  readonly openFolder: ((path: string) => Promise<OpenedFolder>) | null;
  /** Системный выбор папки; null — нет на этой платформе. */
  readonly pickFolder: ((title: string) => Promise<string | null>) | null;
  /** Общая память Android; null — не Android. */
  readonly storage: StorageAccess | null;
  readonly takeShared: () => SharedItem[];
  readonly onShared: (listener: () => void) => () => void;
  /** Сеть для превью ссылок (ADR 0005); null — недоступна (браузер при разработке). */
  readonly network: Network | null;
  /** Ссылка — в браузере системы. */
  readonly openUrl: (url: string) => Promise<void>;
  /** Файл папки проектов (путь от неё) — системной программой; null — нельзя. */
  readonly projectsOpen: ((relativePath: string, mime: string) => Promise<void>) | null;
  /** Перезапуск после смены папки проектов. */
  readonly restart: () => void;
}
