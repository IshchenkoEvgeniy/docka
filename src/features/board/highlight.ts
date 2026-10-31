import {
  hasTag,
  normalizeForSearch,
  taggedIds,
  tagIdsOf,
  type BoardElement,
  type Tag,
} from '../../core';
import { definitionFor } from '../../elements';
import type { BoardModel } from './model';

/** Теги элемента для фильтра: отмеченные и поставленные в тексте через «#» (ADR 0006). */
export function elementTagIds(model: BoardModel, element: BoardElement): string[] {
  const rich = model.richTextOf(element.id);
  return [...tagIdsOf(element.tags), ...(rich === null ? [] : taggedIds(rich))];
}

/** Текст элемента для поиска по доске: то, что тип отдаёт простым текстом. */
export function elementText(model: BoardModel, element: BoardElement): string {
  return definitionFor(element.type).toPlainText(element, model.richTextOf(element.id));
}

/**
 * Что подсветить: элементы с тегом (и вложенными) и/или с найденным текстом.
 * null — подсветки нет. Карточки в колонке подсвечивают и саму колонку.
 */
export function computeHighlight(
  model: BoardModel,
  tags: ReadonlyMap<string, Tag>,
): ReadonlySet<string> | null {
  const { tagFilter, find } = model.settings.getState();
  const query = find === null ? '' : normalizeForSearch(find);
  if (tagFilter === null && query === '') return null;
  const elements = model.elements.getSnapshot();
  const result = new Set<string>();
  for (const element of elements.values()) {
    const byTag = tagFilter === null || hasTag(elementTagIds(model, element), tagFilter, tags);
    const byText = query === '' || normalizeForSearch(elementText(model, element)).includes(query);
    if (!byTag || !byText) continue;
    result.add(element.id);
    if (element.parentId !== null) result.add(element.parentId);
  }
  return result;
}
