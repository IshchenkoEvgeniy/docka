import { describe, expect, it } from 'vitest';
import type { BoardElement } from '../../core';
import { copyContent, parsePayload, placePayload, serializePayload } from './clipboard';

const note = (x: number, text: string) =>
  ({
    id: `id-${text}-0000`,
    boardId: 'board-0000',
    type: 'note',
    x,
    y: 0,
    width: 100,
    height: 50,
    z: 1,
    parentId: null,
    color: 'yellow',
    locked: true,
    tagIds: [],
    createdAt: 0,
    updatedAt: 0,
    deletedAt: null,
    data: { text },
  }) as unknown as BoardElement; // id не проходят через бренд-схему: тесту они не важны

describe('буфер обмена элементов', () => {
  it('JSON туда и обратно, текст для других программ', () => {
    const content = copyContent([note(0, 'Таверна'), note(200, 'Кузница')], () => null);
    if (content === null) throw new Error('пусто');
    expect(content.plainText).toBe('Таверна\n\nКузница');
    const parsed = parsePayload(serializePayload(content.payload));
    expect(parsed?.elements).toHaveLength(2);
  });

  it('вставка сохраняет раскладку, центр — в точке вставки, без закрепления', () => {
    const content = copyContent([note(0, 'а'), note(200, 'б')], () => null);
    if (content === null) throw new Error('пусто');
    const placed = placePayload(content.payload, { x: 1000, y: 1000 });
    expect(placed.map((item) => item.placement.x)).toEqual([850, 1050]);
    expect(placed[0]?.placement.y).toBe(975);
    expect(placed[0]?.locked).toBeUndefined();
  });

  it('форматированный текст копируется вместе с элементом', () => {
    const rich = [
      {
        type: 'element' as const,
        name: 'paragraph',
        children: [{ type: 'text' as const, text: 'Новый текст' }],
      },
    ];
    const content = copyContent([note(0, 'старый')], () => rich);
    if (content === null) throw new Error('пусто');
    expect(content.plainText).toBe('Новый текст');
    const parsed = parsePayload(serializePayload(content.payload));
    expect(parsed?.elements[0]?.richText).toEqual(rich);
    expect(placePayload(content.payload, { x: 0, y: 0 })[0]?.richText).toEqual(rich);
  });

  it('чужой и битый текст — не наш формат', () => {
    expect(parsePayload('просто текст')).toBeNull();
    expect(parsePayload('{"app":"doska","kind":"elements","version":1,"elements":[]}')).toBeNull();
  });
});
