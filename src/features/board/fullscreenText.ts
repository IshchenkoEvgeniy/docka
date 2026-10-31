import type * as Y from 'yjs';
import { definitionFor, type ElementRuntime } from '../../elements';
import type { BoardModel } from './model';

/**
 * Текст для правки на весь экран (телефон). Только у типов с текстом и только на узком экране:
 * иначе правка образца цвета или таблицы создала бы в записи лишний текст.
 */
export function fullscreenFragment(
  model: BoardModel,
  runtime: Pick<ElementRuntime, 'ensureText' | 'fullscreenEditing'>,
  editingId: string | null,
): Y.XmlFragment | null {
  if (editingId === null || !runtime.fullscreenEditing) return null;
  const element = model.elements.getSnapshot().get(editingId);
  if (element === undefined) return null;
  const definition = definitionFor(element.type);
  if (!definition.richText) return null;
  const initial = definition.toRichText(element, model.richTextOf(editingId)) ?? [];
  return runtime.ensureText(editingId, initial);
}
