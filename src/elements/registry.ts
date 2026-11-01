import { t } from '../i18n';
import { createElement } from 'react';
import { z } from 'zod';
import { defineElement } from './defineElement';
import { ElementPlaceholder } from './ElementPlaceholder';
import { boardLink } from './boardLink';
import { checklist } from './checklist';
import { column } from './column';
import { entity } from './entity';
import { file } from './file';
import { frame } from './frame';
import { link } from './link';
import { audio, video } from './media';
import { shape } from './shape';
import { swatch } from './swatch';
import { table } from './table';
import { image } from './image';
import { note } from './note';
import { title } from './title';
import type { ElementDraft, RegisteredElement } from './types';

/** Все типы элементов. Новый тип добавляется сюда одной строкой. */
const ELEMENTS: readonly RegisteredElement[] = [
  note,
  title,
  image,
  boardLink,
  column,
  frame,
  checklist,
  entity,
  swatch,
  shape,
  table,
  link,
  video,
  audio,
  // «Любой файл» — последним: definitionForFile берёт первый подходящий тип.
  file,
];

const BY_TYPE = new Map(ELEMENTS.map((element) => [element.type, element]));

/** Тип, которого нет в этой версии (элемент создан более новой): показывается заглушкой и не теряется. */
const unknownElement = defineElement({
  type: 'unknown',
  label: () => t('elementTypes.unknown'),
  dataSchema: z.record(z.string(), z.unknown()),
  defaultSize: { width: 200, height: 100 },
  minSize: { width: 40, height: 40 },
  resize: 'both',
  richText: false,
  activate: null,
  createData: () => ({}),
  View: () => createElement(ElementPlaceholder, { reason: 'unknown' }),
  toPlainText: () => '',
});

export function definitionFor(type: string): RegisteredElement {
  return BY_TYPE.get(type) ?? unknownElement;
}

export function isKnownType(type: string): boolean {
  return BY_TYPE.has(type);
}

export const elementTypes: readonly string[] = ELEMENTS.map((element) => element.type);

/** Первый тип, который узнаёт вставленный текст (таблица из Excel); null — обычная заметка. */
export function draftFromPastedText(
  text: string,
): { readonly type: string; readonly draft: ElementDraft } | null {
  for (const element of ELEMENTS) {
    const draft = element.fromPastedText?.(text) ?? null;
    if (draft !== null) return { type: element.type, draft };
  }
  return null;
}

/** Тип элемента для файла по его MIME: видео и звук — плеер, остальное — карточка файла. */
export function definitionForFile(mime: string): RegisteredElement | null {
  return ELEMENTS.find((element) => element.fromFile?.accepts(mime) === true) ?? null;
}
