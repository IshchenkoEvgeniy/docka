/** Пункт списка: текст и вложенные пункты (вставка списка картой и вывод карты списком). */
export interface OutlineItem {
  readonly text: string;
  readonly children: readonly OutlineItem[];
}

/** Не больше стольких пунктов: защита от вставки огромного текста. */
export const OUTLINE_LIMIT = 500;
const MARKER = /^(?:[-*+•]|\d{1,3}[.)])\s+/;
const TAB_WIDTH = 4;

interface Line {
  readonly indent: number;
  readonly text: string;
  readonly marked: boolean;
}

function readLine(raw: string): Line | null {
  const body = raw.trimStart();
  if (body.trim() === '') return null;
  const lead = raw.slice(0, raw.length - body.length);
  const tabs = lead.length - lead.replaceAll('\t', '').length;
  const indent = lead.length + tabs * (TAB_WIDTH - 1);
  const marked = MARKER.test(body);
  return { indent, text: body.replace(MARKER, '').trim(), marked };
}

interface Building {
  readonly text: string;
  readonly children: Building[];
}

const depthOf = (items: readonly OutlineItem[]): number =>
  items.reduce((max, item) => Math.max(max, 1 + depthOf(item.children)), 0);

/**
 * Текст → пункты по отступам. Без force картой считается только список, где каждая строка
 * с маркером («-», «*», «1.») и есть хотя бы два уровня; иначе null — обычная вставка.
 * force — «вставить как майнд-карту»: каждая строка становится пунктом.
 */
export function parseOutline(text: string, force = false): OutlineItem[] | null {
  const lines = text.split(/\r?\n/).flatMap((raw) => readLine(raw) ?? []);
  if (lines.length === 0 || lines.length > OUTLINE_LIMIT) return null;
  if (!force && lines.some((line) => !line.marked)) return null;
  const roots: Building[] = [];
  const stack: { indent: number; item: Building }[] = [];
  for (const line of lines) {
    while (stack.length > 0 && (stack[stack.length - 1]?.indent ?? 0) >= line.indent) stack.pop();
    const item: Building = { text: line.text, children: [] };
    (stack[stack.length - 1]?.item.children ?? roots).push(item);
    stack.push({ indent: line.indent, item });
  }
  if (!force && depthOf(roots) < 2) return null;
  return roots;
}

/** Пункты → вложенный список Markdown (два пробела на уровень). */
export function formatOutline(items: readonly OutlineItem[], depth = 0): string[] {
  return items.flatMap((item) => [
    `${'  '.repeat(depth)}- ${item.text}`,
    ...formatOutline(item.children, depth + 1),
  ]);
}
