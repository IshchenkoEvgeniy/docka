/** Окончания множественных форм i18next: `files_one`, `files_few`… — ключ в коде просто `files`. */
type PluralSuffix = 'zero' | 'one' | 'two' | 'few' | 'many' | 'other';

type Leaf<K extends string> = K extends `${infer Base}_${PluralSuffix}` ? Base : K;

/** Все пути «a.b.c» к строкам в объекте сообщений. */
export type MessageKey<T, Prefix extends string = ''> = {
  [K in keyof T & string]: T[K] extends string
    ? `${Prefix}${Leaf<K>}`
    : MessageKey<T[K], `${Prefix}${K}.`>;
}[keyof T & string];
