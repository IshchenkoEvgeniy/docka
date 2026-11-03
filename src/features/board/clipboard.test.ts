import { describe, expect, it } from 'vitest';
import { buildMindMapForest, type BoardElement } from '../../core';
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
    tags: {},
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

  it('карта копируется с местами в карте, текстом — вложенным списком', () => {
    const tree = (parentId: string | null, order = 0) => ({
      parentId,
      order,
      collapsed: false,
      offset: null,
      ...(parentId === null ? { direction: 'both' } : {}),
    });
    const withTree = (element: BoardElement, parentId: string | null, order = 0) =>
      ({ ...element, tree: tree(parentId, order) }) as unknown as BoardElement; // тестовые id
    const root = withTree(note(0, 'Квест'), null);
    const a = withTree(note(300, 'Таверна'), 'id-Квест-0000', 1);
    const b = withTree(note(300, 'Кузница'), 'id-Квест-0000', 0);
    const loose = note(900, 'Заметка');
    const forest = buildMindMapForest([root, a, b, loose]);
    const content = copyContent([a, root, loose, b], () => null, forest);
    if (content === null) throw new Error('пусто');
    expect(content.plainText).toBe('- Квест\n  - Кузница\n  - Таверна\n\nЗаметка');
    expect(content.payload.elements.map((item) => item.mindMap)).toEqual([
      { order: 1, collapsed: false, parentIndex: 1 },
      { order: 0, collapsed: false, direction: 'both' },
      undefined,
      { order: 0, collapsed: false, parentIndex: 1 },
    ]);
    const placed = placePayload(content.payload, { x: 0, y: 0 });
    expect(placed[0]?.mindMap?.parentIndex).toBe(1);
  });

  it('узел без скопированного родителя — корень новой карты с направлением исходной', () => {
    const child = {
      ...note(300, 'Таверна'),
      tree: { parentId: 'id-Квест-0000', order: 0, collapsed: false, offset: null },
    } as unknown as BoardElement; // тестовые id
    const root = {
      ...note(0, 'Квест'),
      tree: { parentId: null, order: 0, collapsed: false, offset: null, direction: 'down' },
    } as unknown as BoardElement;
    const content = copyContent([child], () => null, buildMindMapForest([root, child]));
    expect(content?.payload.elements[0]?.mindMap).toEqual({
      order: 0,
      collapsed: false,
      direction: 'down',
    });
    expect(content?.plainText).toBe('- Таверна');
  });
});
