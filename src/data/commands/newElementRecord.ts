import * as Y from 'yjs';
import type { BoardElement, RichNode } from '../../core';
import { TEXT_FIELD, fillFragment } from '../richText';
import { createRecord } from '../yjsRecords';

/** Кладёт проверенный новый элемент в документ; форматированный текст — отдельным полем. */
export function writeNewElement(
  doc: Y.Doc,
  element: BoardElement,
  richText: readonly RichNode[] | undefined,
): void {
  const record = createRecord(element);
  doc.getMap<unknown>('elements').set(element.id, record);
  if (richText === undefined) return;
  const fragment = new Y.XmlFragment();
  record.set(TEXT_FIELD, fragment);
  fillFragment(fragment, richText);
}
