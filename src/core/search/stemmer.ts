/**
 * Русский стеммер Snowball (snowballstem.org/algorithms/russian): отбрасывает окончания,
 * чтобы «таверна», «таверны», «таверной» искались одинаково (ADR 0006).
 */

const VOWELS = 'аеиоуыэюя';
const isVowel = (char: string | undefined) => char !== undefined && VOWELS.includes(char);

/** Окончания: group1 — только после «а» или «я» (они остаются), group2 — без условия. */
interface Endings {
  readonly group1: readonly string[];
  readonly group2: readonly string[];
}

const PERFECTIVE_GERUND: Endings = {
  group1: ['в', 'вши', 'вшись'],
  group2: ['ив', 'ивши', 'ившись', 'ыв', 'ывши', 'ывшись'],
};
const ADJECTIVE: Endings = {
  group1: [],
  group2: [
    'ее',
    'ие',
    'ые',
    'ое',
    'ими',
    'ыми',
    'ей',
    'ий',
    'ый',
    'ой',
    'ем',
    'им',
    'ым',
    'ом',
    'его',
    'ого',
    'ему',
    'ому',
    'их',
    'ых',
    'ую',
    'юю',
    'ая',
    'яя',
    'ою',
    'ею',
  ],
};
const PARTICIPLE: Endings = {
  group1: ['ем', 'нн', 'вш', 'ющ', 'щ'],
  group2: ['ивш', 'ывш', 'ующ'],
};
const REFLEXIVE: Endings = { group1: [], group2: ['ся', 'сь'] };
const VERB: Endings = {
  group1: [
    'ла',
    'на',
    'ете',
    'йте',
    'ли',
    'й',
    'л',
    'ем',
    'н',
    'ло',
    'но',
    'ет',
    'ют',
    'ны',
    'ть',
    'ешь',
    'нно',
  ],
  group2: [
    'ила',
    'ыла',
    'ена',
    'ейте',
    'уйте',
    'ите',
    'или',
    'ыли',
    'ей',
    'уй',
    'ил',
    'ыл',
    'им',
    'ым',
    'ен',
    'ило',
    'ыло',
    'ено',
    'ят',
    'ует',
    'уют',
    'ит',
    'ыт',
    'ены',
    'ить',
    'ыть',
    'ишь',
    'ую',
    'ю',
  ],
};
const NOUN: Endings = {
  group1: [],
  group2: [
    'а',
    'ев',
    'ов',
    'ие',
    'ье',
    'е',
    'иями',
    'ями',
    'ами',
    'еи',
    'ии',
    'и',
    'ией',
    'ей',
    'ой',
    'ий',
    'й',
    'иям',
    'ям',
    'ием',
    'ем',
    'ам',
    'ом',
    'о',
    'у',
    'ах',
    'иях',
    'ях',
    'ы',
    'ь',
    'ию',
    'ью',
    'ю',
    'ия',
    'ья',
    'я',
  ],
};

/** Начало области после первой гласной (RV) и областей R1, R2. */
function regions(word: string): { rv: number; r1: number; r2: number } {
  const afterVowelConsonant = (from: number) => {
    for (let i = from + 1; i < word.length; i += 1)
      if (!isVowel(word[i]) && isVowel(word[i - 1])) return i + 1;
    return word.length;
  };
  const firstVowel = word.search(/[аеиоуыэюя]/);
  const rv = firstVowel < 0 ? word.length : firstVowel + 1;
  const r1 = afterVowelConsonant(0);
  return { rv, r1, r2: afterVowelConsonant(r1) };
}

/** Самое длинное окончание из списка в пределах области; null — нет или условие не выполнено. */
function strip(word: string, start: number, endings: Endings): string | null {
  const all = [
    ...endings.group1.map((ending) => ({ ending, after: true })),
    ...endings.group2.map((ending) => ({ ending, after: false })),
  ].sort((a, b) => b.ending.length - a.ending.length);
  const found = all.find(
    ({ ending }) => word.endsWith(ending) && word.length - ending.length >= start,
  );
  if (found === undefined) return null;
  const cut = word.length - found.ending.length;
  if (found.after && (cut - 1 < start || !'ая'.includes(word[cut - 1] ?? ''))) return null;
  return word.slice(0, cut);
}

function stepOne(word: string, rv: number): string {
  const gerund = strip(word, rv, PERFECTIVE_GERUND);
  if (gerund !== null) return gerund;
  const base = strip(word, rv, REFLEXIVE) ?? word;
  const adjective = strip(base, rv, ADJECTIVE);
  if (adjective !== null) return strip(adjective, rv, PARTICIPLE) ?? adjective;
  return strip(base, rv, VERB) ?? strip(base, rv, NOUN) ?? base;
}

function stepFour(word: string, rv: number): string {
  const inRv = (suffix: string) => word.endsWith(suffix) && word.length - suffix.length >= rv;
  if (inRv('нн')) return word.slice(0, -1);
  const superlative = strip(word, rv, { group1: [], group2: ['ейш', 'ейше'] });
  if (superlative !== null)
    return superlative.endsWith('нн') ? superlative.slice(0, -1) : superlative;
  return inRv('ь') ? word.slice(0, -1) : word;
}

/** Основа русского слова (строчные буквы, «ё» уже заменена на «е»). */
export function stemRussian(word: string): string {
  const { rv, r2 } = regions(word);
  let stem = stepOne(word, rv);
  if (stem.endsWith('и') && stem.length - 1 >= rv) stem = stem.slice(0, -1);
  const derivational = strip(stem, r2, { group1: [], group2: ['ост', 'ость'] });
  if (derivational !== null) stem = derivational;
  return stepFour(stem, rv);
}
