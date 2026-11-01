export interface ClipboardFile {
  readonly name: string;
  readonly mime: string;
  readonly bytes: Uint8Array;
}

export interface SystemClipboard {
  /** Время последней системной записи (Android); позволяет отличить свежую копию карточки от старого буфера. */
  readonly changedAt?: number;
  readonly text: string;
  readonly files: readonly ClipboardFile[];
}

/** Только явное действие пользователя; адаптер может отказать в доступе. */
export type ClipboardReader = () => Promise<SystemClipboard>;
