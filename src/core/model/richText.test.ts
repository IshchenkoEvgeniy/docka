import { describe, expect, it } from 'vitest';
import { RichTextSchema, plainToRichText, richTextToPlain, type RichNode } from './richText';

const p = (...children: RichNode[]): RichNode => ({ type: 'element', name: 'paragraph', children });
const text = (value: string, marks?: Record<string, unknown>): RichNode =>
  marks === undefined ? { type: 'text', text: value } : { type: 'text', text: value, marks };

describe('форматированный текст', () => {
  it('простой текст: строки и абзацы', () => {
    const nodes = plainToRichText('Таверна\r\n\r\nКузнец');
    expect(nodes).toHaveLength(3);
    expect(richTextToPlain(nodes)).toBe('Таверна\nКузнец');
  });

  it('списки и переносы строк — отдельными строками, пометки не мешают', () => {
    const nodes: RichNode[] = [
      { type: 'element', name: 'heading', attrs: { level: 1 }, children: [text('НПС')] },
      p(text('Борис '), text('кузнец', { bold: true })),
      {
        type: 'element',
        name: 'bulletList',
        children: [
          { type: 'element', name: 'listItem', children: [p(text('меч'))] },
          { type: 'element', name: 'listItem', children: [p(text('щит'))] },
        ],
      },
      p(text('a'), { type: 'element', name: 'hardBreak', children: [] }, text('b')),
    ];
    expect(richTextToPlain(nodes)).toBe('НПС\nБорис кузнец\nмеч\nщит\na\nb');
    expect(RichTextSchema.safeParse(nodes).success).toBe(true);
  });

  it('чужие данные не проходят проверку', () => {
    expect(
      RichTextSchema.safeParse([{ type: 'element', name: '<script>', children: [] }]).success,
    ).toBe(false);
  });
});
