export interface ExportFile {
  readonly name: string;
  readonly mime: string;
  readonly bytes: Uint8Array;
}

/** Системное «Сохранить как». false — пользователь отменил выбор. */
export type FileSaver = (file: ExportFile) => Promise<boolean>;
