/**
 * Мост к Android (MainActivity.kt → window.DoskaAndroid). На компьютере и в браузере его нет.
 */
interface DoskaAndroid {
  hasAllFilesAccess(): boolean;
  requestAllFilesAccess(): void;
  externalStorageRoot(): string;
  takeShared(): string;
  openFile(path: string, mime: string): boolean;
}

/** Получено через «Поделиться → Доска». Файл — в base64 (как его отдаёт Android). */
export type SharedItem =
  | { readonly kind: 'text'; readonly text: string }
  | {
      readonly kind: 'file';
      readonly name: string;
      readonly mime: string;
      readonly base64: string;
    };

function bridge(): DoskaAndroid | null {
  const candidate: unknown = Reflect.get(window, 'DoskaAndroid');
  return typeof candidate === 'object' && candidate !== null ? (candidate as DoskaAndroid) : null; // объект из addJavascriptInterface
}

/** Открывает файл программой Android (FileProvider); null — не Android. */
export function androidFileOpener(): ((path: string, mime: string) => boolean) | null {
  const android = bridge();
  return android === null ? null : (path, mime) => android.openFile(path, mime);
}

export interface AndroidStorage {
  readonly hasAllFilesAccess: () => boolean;
  readonly requestAllFilesAccess: () => void;
  /** Предлагаемая папка проектов в общей памяти: /storage/emulated/0/Doska. */
  readonly suggestedProjectsFolder: () => string;
}

/** Доступ к общей памяти Android; null — не Android. */
export function androidStorage(): AndroidStorage | null {
  const android = bridge();
  if (android === null) return null;
  return {
    hasAllFilesAccess: () => android.hasAllFilesAccess(),
    requestAllFilesAccess: () => {
      android.requestAllFilesAccess();
    },
    suggestedProjectsFolder: () => `${android.externalStorageRoot()}/Doska`,
  };
}

function isSharedItem(value: unknown): value is SharedItem {
  if (typeof value !== 'object' || value === null) return false;
  const item = value as Record<string, unknown>;
  if (item.kind === 'text') return typeof item.text === 'string';
  return (
    item.kind === 'file' &&
    typeof item.name === 'string' &&
    typeof item.mime === 'string' &&
    typeof item.base64 === 'string'
  );
}

/** Забирает полученное через «Поделиться» (пусто, если ничего не было или это не Android). */
export function takeSharedItems(): SharedItem[] {
  const android = bridge();
  if (android === null) return [];
  try {
    const parsed: unknown = JSON.parse(android.takeShared());
    return Array.isArray(parsed) ? parsed.filter(isSharedItem) : [];
  } catch {
    return [];
  }
}

/** Подписка на новое «Поделиться» (Android присылает событие doska-shared). */
export function onShared(listener: () => void): () => void {
  window.addEventListener('doska-shared', listener);
  return () => {
    window.removeEventListener('doska-shared', listener);
  };
}
