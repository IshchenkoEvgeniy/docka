import { z } from 'zod';

/**
 * Форматированный текст без привязки к редактору: дерево узлов, как оно лежит в Yjs
 * (Y.XmlElement с именем и атрибутами, Y.XmlText с пометками). Нужен для буфера обмена,
 * поиска, экспорта и показа текста без запуска редактора.
 */
export type RichNode =
  | {
      readonly type: 'text';
      readonly text: string;
      /** Пометки ProseMirror: bold, italic, link: { href }… */
      readonly marks?: Readonly<Record<string, unknown>> | undefined;
    }
  | {
      readonly type: 'element';
      /** Имя узла ProseMirror: paragraph, heading, bulletList, listItem… */
      readonly name: string;
      readonly attrs?: Readonly<Record<string, unknown>> | undefined;
      readonly children: readonly RichNode[];
    };

const MAX_NODES = 20_000;

export const RichNodeSchema: z.ZodType<RichNode> = z.lazy(() =>
  z.union([
    z.object({
      type: z.literal('text'),
      text: z.string().max(200_000),
      marks: z.record(z.string(), z.unknown()).optional(),
    }),
    z.object({
      type: z.literal('element'),
      name: z.string().regex(/^[A-Za-z][A-Za-z0-9]{0,40}$/),
      attrs: z.record(z.string(), z.unknown()).optional(),
      children: z.array(RichNodeSchema).max(MAX_NODES),
    }),
  ]),
);

export const RichTextSchema = z.array(RichNodeSchema).max(MAX_NODES);

/** Узлы, после которых в простом тексте начинается новая строка. */
const BLOCKS = new Set(['paragraph', 'heading', 'listItem', 'blockquote', 'taskItem']);

function plainOf(node: RichNode, lines: string[]): void {
  if (node.type === 'text') {
    lines[lines.length - 1] = (lines.at(-1) ?? '') + node.text;
    return;
  }
  if (node.name === 'hardBreak') {
    lines.push('');
    return;
  }
  const block = BLOCKS.has(node.name);
  if (block && lines[lines.length - 1] !== '') lines.push('');
  for (const child of node.children) plainOf(child, lines);
  if (block) lines.push('');
}

/** Простой текст: абзацы и пункты списков — отдельными строками. */
export function richTextToPlain(nodes: readonly RichNode[]): string {
  const lines = [''];
  for (const node of nodes) plainOf(node, lines);
  return lines
    .join('\n')
    .replace(/\n{2,}/g, '\n')
    .trim();
}

/** Простой текст → абзацы (вставка текста из другой программы, старые заметки). */
export function plainToRichText(text: string): RichNode[] {
  return text
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => ({
      type: 'element' as const,
      name: 'paragraph',
      children: line === '' ? [] : [{ type: 'text' as const, text: line }],
    }));
}
