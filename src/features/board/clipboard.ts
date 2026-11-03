import { z } from 'zod';
import { createStore } from 'zustand/vanilla';
import { boundsOf, type Point } from '../../canvas';
import {
  ElementSchema,
  MindMapPlacementSchema,
  RichTextSchema,
  formatOutline,
  TagIdSchema,
  tagIdsOf,
  type TagId,
  type BoardElement,
  type NewElement,
  type MindMapForest,
  type MindMapPlacement,
  type OutlineItem,
  type RichNode,
} from '../../core';
import { definitionFor } from '../../elements';

/**
 * Буфер обмена элементов. В системный буфер кладутся два вида: свой JSON (вставка в Доску,
 * в том числе на другую доску) и обычный текст (вставка в другие программы).
 */
export const CLIPBOARD_MIME = 'application/x-doska+json';
/** Перетаскивание из библиотеки: те же элементы, но кладутся как есть (ссылка на сущность). */
export const PLACE_MIME = 'application/x-doska-place+json';

const ClipboardElementSchema = ElementSchema.pick({
  type: true,
  x: true,
  y: true,
  width: true,
  height: true,
  color: true,
  data: true,
}).extend({
  /** Теги — списком id: формат буфера не зависит от хранения в Yjs. */
  tagIds: z.array(TagIdSchema),
  richText: RichTextSchema.optional(),
  /** Карточка колонки: номер колонки в этом же списке (координаты — порядок внутри неё). */
  parentIndex: z.number().int().nonnegative().optional(),
  /** Узел майнд-карты: родитель — номер в этом же списке; нет — корень новой карты. */
  mindMap: MindMapPlacementSchema.optional(),
});

const ClipboardPayloadSchema = z.object({
  app: z.literal('doska'),
  kind: z.literal('elements'),
  version: z.literal(1),
  /** Снизу вверх по наложению. */
  elements: z.array(ClipboardElementSchema).min(1).max(5000),
});
export type ClipboardPayload = z.infer<typeof ClipboardPayloadSchema>;

export interface ClipboardContent {
  readonly payload: ClipboardPayload;
  readonly plainText: string;
}

/** Место узла в пачке: родитель, если он тоже копируется; иначе — корень с направлением карты. */
function placementOf(
  forest: MindMapForest | null,
  id: string,
  indexOf: ReadonlyMap<string, number>,
): MindMapPlacement | undefined {
  const node = forest?.nodes.get(id);
  if (forest === null || node === undefined) return undefined;
  const parentIndex = node.parentId === null ? undefined : indexOf.get(node.parentId);
  const base = { order: node.link.order, collapsed: node.link.collapsed };
  if (parentIndex === undefined) {
    const direction = forest.nodes.get(node.rootId)?.link.direction;
    return { ...base, ...(direction === undefined ? {} : { direction }) };
  }
  return {
    ...base,
    parentIndex,
    ...(node.link.side === undefined ? {} : { side: node.link.side }),
  };
}

/** Текст копии: карточки — абзацами, карты — вложенными списками (первая строка узла). */
function plainTextOf(
  elements: readonly BoardElement[],
  texts: ReadonlyMap<string, string>,
  places: readonly (MindMapPlacement | undefined)[],
): string {
  const childrenOf = new Map<number, number[]>();
  places.forEach((place, index) => {
    if (place?.parentIndex === undefined) return;
    childrenOf.set(place.parentIndex, [...(childrenOf.get(place.parentIndex) ?? []), index]);
  });
  const textAt = (index: number) => texts.get(elements[index]?.id ?? '') ?? '';
  const item = (index: number, seen: Set<number>): OutlineItem => {
    seen.add(index);
    const kids = (childrenOf.get(index) ?? [])
      .filter((kid) => !seen.has(kid))
      .sort((a, b) => (places[a]?.order ?? 0) - (places[b]?.order ?? 0));
    return {
      text: textAt(index).split('\n')[0] ?? '',
      children: kids.map((kid) => item(kid, seen)),
    };
  };
  const blocks = elements.flatMap((_, index) => {
    const place = places[index];
    if (place === undefined) return textAt(index) === '' ? [] : [textAt(index)];
    if (place.parentIndex !== undefined) return [];
    return [formatOutline([item(index, new Set())]).join('\n')];
  });
  return blocks.join('\n\n');
}

/**
 * elements — в порядке наложения снизу вверх; richTextOf — текст элемента из Yjs;
 * forest — карты доски: узлы копируются вместе с местом в карте (ADR 0011).
 */
export function copyContent(
  elements: readonly BoardElement[],
  richTextOf: (elementId: string) => readonly RichNode[] | null,
  forest: MindMapForest | null = null,
): ClipboardContent | null {
  if (elements.length === 0) return null;
  const texts = new Map<string, string>();
  const indexOf = new Map(elements.map((element, index) => [element.id as string, index]));
  const places = elements.map((element) => placementOf(forest, element.id, indexOf));
  const copied = elements.map((element, index) => {
    const { type, x, y, width, height, color, data } = element;
    const tagIds = tagIdsOf(element.tags).flatMap((id): TagId[] => {
      const parsed = TagIdSchema.safeParse(id);
      return parsed.success ? [parsed.data] : [];
    });
    const definition = definitionFor(type);
    const stored = richTextOf(element.id);
    const richText = definition.toRichText(element, stored);
    texts.set(element.id, definition.toPlainText(element, stored));
    const parentIndex = element.parentId === null ? undefined : indexOf.get(element.parentId);
    const mindMap = places[index];
    const base = {
      type,
      x,
      y,
      width,
      height,
      color,
      tagIds,
      data,
      ...(parentIndex === undefined ? {} : { parentIndex }),
      ...(mindMap === undefined ? {} : { mindMap }),
    };
    return richText === null ? base : { ...base, richText: [...richText] };
  });
  const payload: ClipboardPayload = {
    app: 'doska',
    kind: 'elements',
    version: 1,
    elements: copied,
  };
  return { payload, plainText: plainTextOf(elements, texts, places) };
}

export function serializePayload(payload: ClipboardPayload): string {
  return JSON.stringify(payload);
}

export function parsePayload(text: string): ClipboardPayload | null {
  try {
    const parsed = ClipboardPayloadSchema.safeParse(JSON.parse(text));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

/** Новые элементы с прежней раскладкой, центр группы — в точке center. */
export function placePayload(payload: ClipboardPayload, center: Point): NewElement[] {
  // Карточки колонок хранят порядок, а не координаты: в рамку группы не входят и не сдвигаются.
  const bounds = boundsOf(payload.elements.filter((element) => element.parentIndex === undefined));
  if (bounds === null) return [];
  const dx = Math.round(center.x - (bounds.x + bounds.width / 2));
  const dy = Math.round(center.y - (bounds.y + bounds.height / 2));
  return payload.elements.map((element) => {
    const shift = element.parentIndex === undefined ? 1 : 0;
    return {
      type: element.type,
      placement: {
        x: element.x + dx * shift,
        y: element.y + dy * shift,
        width: element.width,
        height: element.height,
      },
      color: element.color,
      tagIds: element.tagIds,
      data: element.data,
      ...(element.richText === undefined ? {} : { richText: element.richText }),
      ...(element.parentIndex === undefined ? {} : { parentIndex: element.parentIndex }),
      ...(element.mindMap === undefined ? {} : { mindMap: element.mindMap }),
    };
  });
}

/**
 * Последнее скопированное в приложении: вставка из меню (у меню нет события paste)
 * и запасной путь, если система не сохранила свой формат.
 */
export const appClipboard = createStore<{
  readonly content: ClipboardContent | null;
  readonly copiedAt: number;
}>(() => ({
  content: null,
  copiedAt: 0,
}));
