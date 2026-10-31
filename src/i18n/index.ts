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

/** Дата из поля «дата» (ГГГГ-ММ-ДД): «31 октября 2026». */
export function formatDate(isoDate: string): string {
  const [year, month, day] = isoDate.split('-').map(Number);
  if (year === undefined || month === undefined || day === undefined) return isoDate;
  return new Intl.DateTimeFormat(instance.language, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(year, month - 1, day));
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat(instance.language).format(value);
}

/** Размер файла по правилам языка: «820 КБ», «1,2 МБ». */
export function formatFileSize(bytes: number): string {
  const [unit, value] =
    bytes >= 1024 * 1024
      ? (['megabyte', bytes / (1024 * 1024)] as const)
      : bytes >= 1024
        ? (['kilobyte', bytes / 1024] as const)
        : (['byte', bytes] as const);
  return new Intl.NumberFormat(instance.language, {
    style: 'unit',
    unit,
    maximumFractionDigits: value < 10 ? 1 : 0,
  }).format(value);
}
