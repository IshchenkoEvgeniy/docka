import { describe, expect, it } from 'vitest';
import { normalizeForSearch, searchTerm, stemRussian, tokenize } from '.';

describe('русский стеммер', () => {
  it('эталонные слова Snowball', () => {
    const cases: [string, string][] = [
      ['вагон', 'вагон'],
      ['вагона', 'вагон'],
      ['вагонов', 'вагон'],
      ['важнейшие', 'важн'],
      ['важного', 'важн'],
      ['вазу', 'ваз'],
      ['вдохновение', 'вдохновен'],
      ['вдохновения', 'вдохновен'],
      ['валентности', 'валентн'],
    ];
    for (const [word, stem] of cases) expect(stemRussian(word)).toBe(stem);
  });

  it('словоформы одного слова дают одну основу', () => {
    const same = (...words: string[]) => new Set(words.map(stemRussian)).size;
    expect(same('таверна', 'таверны', 'таверной', 'таверне', 'таверну')).toBe(1);
    expect(same('кузнец', 'кузнеца', 'кузнецом', 'кузнецы')).toBe(1);
    expect(same('пропавшая', 'пропавшую', 'пропавший')).toBe(1);
    expect(same('квест', 'квесты', 'квестов', 'квестами')).toBe(1);
  });

  it('нормализация и слова: ё, регистр, латиница и цифры', () => {
    expect(normalizeForSearch('  Ёлка   ЗЕЛЁНАЯ ')).toBe('елка зеленая');
    expect(tokenize('NPC-2: Борис, «кузнец»')).toEqual(['npc', '2', 'борис', 'кузнец']);
    expect(searchTerm('Таверной')).toBe(stemRussian('таверной'));
    expect(searchTerm('API')).toBe('api');
  });
});
