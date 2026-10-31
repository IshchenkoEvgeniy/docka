import * as Y from 'yjs';
import type { RichNode } from '../core';

/**
 * Текст элемента — Y.XmlFragment в поле `text` записи элемента (рядом с x, y, data).
 * Так правки текста с разных устройств сливаются посимвольно, а удаление, восстановление
 * и отмена элемента захватывают и его текст. Раскладку узлов задаёт y-prosemirror.
 */
export const TEXT_FIELD = 'text';

/** Создание текста у старой заметки (был только data.text): не шаг отмены. */
export const TEXT_INIT_ORIGIN = Symbol('text-init');
/** Измеренная высота после правки текста: не шаг отмены. */
export const MEASURE_ORIGIN = Symbol('measure');

type XmlChild = Y.XmlElement | Y.XmlText;

function textToRich(text: Y.XmlText): RichNode[] {
  const delta = text.toDelta() as { insert: unknown; attributes?: Record<string, unknown> }[];
  return delta.flatMap((op) =>
    typeof op.insert === 'string'
      ? [
          op.attributes === undefined
            ? { type: 'text' as const, text: op.insert }
            : { type: 'text' as const, text: op.insert, marks: op.attributes },
        ]
      : [],
  );
}

function childrenToRich(children: readonly unknown[]): RichNode[] {
  return children.flatMap((child): RichNode[] => {
    if (child instanceof Y.XmlText) return textToRich(child);
    if (!(child instanceof Y.XmlElement)) return [];
    const attrs = child.getAttributes() as Record<string, unknown>;
    const node = {
      type: 'element' as const,
      name: child.nodeName,
      children: childrenToRich(child.toArray()),
    };
    return [Object.keys(attrs).length === 0 ? node : { ...node, attrs }];
  });
}

/** Текст из Yjs в нейтральный вид (буфер обмена, поиск, показ без редактора). */
export function fragmentToRich(fragment: Y.XmlFragment): RichNode[] {
  return childrenToRich(fragment.toArray());
}

function richToChildren(nodes: readonly RichNode[]): XmlChild[] {
  const result: XmlChild[] = [];
  let text: Y.XmlText | null = null;
  let length = 0;
  for (const node of nodes) {
    if (node.type === 'text') {
      // Подряд идущий текст — один Y.XmlText с разметкой, как у y-prosemirror.
      if (text === null) {
        text = new Y.XmlText();
        length = 0;
        result.push(text);
      }
      text.insert(length, node.text, node.marks === undefined ? {} : { ...node.marks });
      length += node.text.length;
      continue;
    }
    text = null;
    const element = new Y.XmlElement(node.name);
    for (const [key, value] of Object.entries(node.attrs ?? {}))
      element.setAttribute(key, value as string); // y-prosemirror хранит атрибуты как есть
    element.insert(0, richToChildren(node.children));
    result.push(element);
  }
  return result;
}

/** Заполняет пустой фрагмент (уже вставленный в документ) узлами. */
export function fillFragment(fragment: Y.XmlFragment, nodes: readonly RichNode[]): void {
  fragment.insert(0, richToChildren(nodes));
}

function recordOf(doc: Y.Doc, elementId: string): Y.Map<unknown> | null {
  const record = doc.getMap<unknown>('elements').get(elementId);
  return record instanceof Y.Map ? (record as Y.Map<unknown>) : null; // записи — Y.Map
}

/** Текст элемента или null (старая заметка без текста в Yjs). */
export function textOf(doc: Y.Doc, elementId: string): Y.XmlFragment | null {
  const text = recordOf(doc, elementId)?.get(TEXT_FIELD);
  return text instanceof Y.XmlFragment ? text : null;
}

/** Текст элемента; если его нет — создаётся из простого текста (старые заметки). */
export function ensureText(
  doc: Y.Doc,
  elementId: string,
  initial: readonly RichNode[],
): Y.XmlFragment | null {
  const existing = textOf(doc, elementId);
  if (existing !== null) return existing;
  const record = recordOf(doc, elementId);
  if (record === null) return null;
  const fragment = new Y.XmlFragment();
  doc.transact(() => {
    record.set(TEXT_FIELD, fragment);
    fillFragment(fragment, initial);
  }, TEXT_INIT_ORIGIN);
  return fragment;
}

const MAX_HEIGHT = 100_000;

/** Записывает высоту, измеренную после правки текста на этом устройстве. */
export function setMeasuredHeight(doc: Y.Doc, elementId: string, height: number): void {
  const record = recordOf(doc, elementId);
  if (record === null || !Number.isFinite(height)) return;
  const value = Math.min(MAX_HEIGHT, Math.max(1, Math.round(height)));
  if (record.get('height') === value) return;
  doc.transact(() => {
    record.set('height', value);
  }, MEASURE_ORIGIN);
}
