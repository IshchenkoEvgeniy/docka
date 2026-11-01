import { z } from 'zod';
import { createStore } from 'zustand/vanilla';
import { boundsOf, type Point } from '../../canvas';
import {
  ElementSchema,
  RichTextSchema,
  TagIdSchema,
  tagIdsOf,
  type TagId,
  type BoardElement,
  type NewElement,
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

/** elements — в порядке наложения снизу вверх; richTextOf — текст элемента из Yjs. */
export function copyContent(
  elements: readonly BoardElement[],
  richTextOf: (elementId: string) => readonly RichNode[] | null,
): ClipboardContent | null {
  if (elements.length === 0) return null;
  const texts: string[] = [];
  const indexOf = new Map(elements.map((element, index) => [element.id as string, index]));
  const copied = elements.map((element) => {
    const { type, x, y, width, height, color, data } = element;
    const tagIds = tagIdsOf(element.tags).flatMap((id): TagId[] => {
      const parsed = TagIdSchema.safeParse(id);
      return parsed.success ? [parsed.data] : [];
    });
    const definition = definitionFor(type);
    const stored = richTextOf(element.id);
    const richText = definition.toRichText(element, stored);
    const text = definition.toPlainText(element, stored);
    if (text !== '') texts.push(text);
    const parentIndex = element.parentId === null ? undefined : indexOf.get(element.parentId);
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
    };
    return richText === null ? base : { ...base, richText: [...richText] };
  });
  const payload: ClipboardPayload = {
    app: 'doska',
    kind: 'elements',
    version: 1,
    elements: copied,
  };
  return { payload, plainText: texts.join('\n\n') };
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
