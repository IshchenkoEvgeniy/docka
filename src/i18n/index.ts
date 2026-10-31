/**
 * Слой i18n: все тексты интерфейса. Строки — в locales/<язык>.json; новый язык = новый файл
 * и строка в LANGUAGES. Множественные формы — суффиксы `_one`, `_few`, `_many`, `_other`.
 */
import i18next from 'i18next';
import ru from './locales/ru.json';
import type { MessageKey } from './messageKey';

export type TranslationKey = MessageKey<typeof ru>;
export type TranslationValues = Readonly<Record<string, string | number>>;

export const LANGUAGES = [{ code: 'ru', name: 'Русский' }] as const;
export type LanguageCode = (typeof LANGUAGES)[number]['code'];
export const DEFAULT_LANGUAGE: LanguageCode = 'ru';

const instance = i18next.createInstance();
void instance.init({
  resources: { ru: { translation: ru } },
  lng: DEFAULT_LANGUAGE,
  fallbackLng: DEFAULT_LANGUAGE,
  // React сам экранирует текст.
  interpolation: { escapeValue: false },
  initAsync: false,
  returnNull: false,
});

/** Перевод по ключу; values — подстановки `{{name}}` и `count` для множественных форм. */
export function t(key: TranslationKey, values?: TranslationValues): string {
  return values === undefined ? instance.t(key) : instance.t(key, { ...values });
}

export function setLanguage(code: LanguageCode): void {
  void instance.changeLanguage(code);
}

export function currentLanguage(): string {
  return instance.language;
}

/** Дата и время по правилам текущего языка: «31 октября, 18:05». */
export function formatDateTime(milliseconds: number): string {
  return new Intl.DateTimeFormat(instance.language, {
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  }).format(milliseconds);
}
