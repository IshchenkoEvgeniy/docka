/** Ответ сервера для превью ссылки: адрес после перенаправлений, тип и тело. */
export interface FetchedResource {
  readonly finalUrl: string;
  readonly contentType: string;
  readonly bytes: Uint8Array;
  /** Тело обрезано по пределу размера. */
  readonly truncated: boolean;
}

/** Сеть — только для превью ссылок (ADR 0005). Ошибка сети — исключение с текстом. */
export interface Network {
  readonly fetch: (url: string) => Promise<FetchedResource>;
}
