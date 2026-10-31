/** Тестовые карточки для замера производительности холста (шаг 0.4). */

export type CardTone = 'plain' | 'yellow' | 'blue' | 'green';

export interface BenchmarkCard {
  readonly id: number;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly tone: CardTone;
  readonly title: string;
  readonly lines: readonly string[];
}

/** Верхняя оценка высоты карточки для отсечения невидимых. */
export const CARD_MAX_HEIGHT = 220;

const TONES: readonly CardTone[] = ['plain', 'plain', 'yellow', 'blue', 'green'];
const WORDS = [
  'персонаж',
  'локация',
  'квест',
  'диалог',
  'предмет',
  'уровень',
  'механика',
  'экран',
  'кнопка',
  'база',
  'данные',
  'сервер',
  'игрок',
  'босс',
  'карта',
  'инвентарь',
  'меню',
  'сюжет',
  'награда',
  'магазин',
  'навык',
  'таверна',
  'город',
  'лес',
  'API',
  'запрос',
];

/** Детерминированный генератор (mulberry32): одинаковые карточки на ПК и телефоне. */
export function createRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick<T>(items: readonly T[], random: () => number): T {
  const item = items.at(Math.floor(random() * items.length));
  if (item === undefined) throw new Error('pick: пустой список');
  return item;
}

function sentence(random: () => number): string {
  const length = 3 + Math.floor(random() * 4);
  return Array.from({ length }, () => pick(WORDS, random)).join(' ');
}

/** Карточки по сетке со случайным сдвигом — похоже на реальную доску, без наложений. */
export function generateCards(count: number, seed = 42): BenchmarkCard[] {
  const random = createRandom(seed);
  const columns = Math.ceil(Math.sqrt(count * 1.5));
  return Array.from({ length: count }, (_, id) => ({
    id,
    x: (id % columns) * 280 + Math.floor(random() * 40),
    y: Math.floor(id / columns) * 260 + Math.floor(random() * 40),
    width: 200 + Math.floor(random() * 50),
    tone: pick(TONES, random),
    title: `#${String(id + 1)} ${pick(WORDS, random)}`,
    lines: Array.from({ length: 1 + Math.floor(random() * 3) }, () => sentence(random)),
  }));
}

/** Габариты области, занятой карточками (для «показать всё»). */
export function cardsBounds(cards: readonly BenchmarkCard[]): { width: number; height: number } {
  return {
    width: Math.max(...cards.map((card) => card.x + card.width)),
    height: Math.max(...cards.map((card) => card.y + CARD_MAX_HEIGHT)),
  };
}

/** Примерная высота карточки по числу строк (для обзорной картинки). */
export function estimatedHeight(card: BenchmarkCard): number {
  return 24 + 30 + card.lines.length * 40;
}

const TONE_TOKENS: Readonly<Record<CardTone, string>> = {
  plain: '--color-surface',
  yellow: '--color-card-yellow',
  blue: '--color-card-blue',
  green: '--color-card-green',
};

/** Карточки как прямоугольники для обзорного режима холста. */
export function toOverviewItems(cards: readonly BenchmarkCard[]) {
  return cards.map((card) => ({
    rect: { x: card.x, y: card.y, width: card.width, height: estimatedHeight(card) },
    fill: TONE_TOKENS[card.tone],
  }));
}
