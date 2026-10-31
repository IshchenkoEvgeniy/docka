import { stemRussian } from './stemmer';

/** Текст для сравнения: строчные, «ё» → «е», пробелы схлопнуты. */
export function normalizeForSearch(text: string): string {
  return text.toLocaleLowerCase('ru').replace(/ё/g, 'е').replace(/\s+/g, ' ').trim();
}

const CYRILLIC = /[а-я]/;

/** Слова текста: буквы и цифры любого языка. */
export function tokenize(text: string): string[] {
  return normalizeForSearch(text).match(/[\p{L}\p{N}]+/gu) ?? [];
}

/** Слово для индекса: русское — основой, остальное — как есть. Пустое — пропустить. */
export function searchTerm(token: string): string | null {
  const word = normalizeForSearch(token);
  if (word === '') return null;
  return CYRILLIC.test(word) ? stemRussian(word) : word;
}
