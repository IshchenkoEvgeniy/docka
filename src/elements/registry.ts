import { createElement } from 'react';
import { z } from 'zod';
import { defineElement } from './defineElement';
import { ElementPlaceholder } from './ElementPlaceholder';
import { boardLink } from './boardLink';
import { checklist } from './checklist';
import { column } from './column';
import { entity } from './entity';
import { image } from './image';
import { note } from './note';
import { title } from './title';
import type { RegisteredElement } from './types';

/** Все типы элементов. Новый тип добавляется сюда одной строкой. */
const ELEMENTS: readonly RegisteredElement[] = [
  note,
  title,
  image,
  boardLink,
  column,
  checklist,
  entity,
];

const BY_TYPE = new Map(ELEMENTS.map((element) => [element.type, element]));

/** Тип, которого нет в этой версии (элемент создан более новой): показывается заглушкой и не теряется. */
const unknownElement = defineElement({
  type: 'unknown',
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
