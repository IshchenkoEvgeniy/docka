import * as Y from 'yjs';
import { buildMindMapForest, layoutMindMap, type BoardElement } from '../core';
import { readElements } from './projectDocument';

/**
 * Есть ли среди ids узлы карт (в том числе удалённые). Дешёвая проверка до чтения всей доски:
 * правки обычных карточек — набор текста, замер высоты — не платят за раскладку.
 */
export function touchesMindMap(doc: Y.Doc, ids: Iterable<string>): boolean {
  const records = doc.getMap<unknown>('elements');
  for (const id of ids) {
    const record = records.get(id);
    if (record instanceof Y.Map && record.get('tree') instanceof Y.Map) return true;
  }
  return false;
}

/** Корни карт, в которых сейчас лежат узлы ids (не узлы пропускаются). */
export function mindMapRootsOf(doc: Y.Doc, ids: Iterable<string>): Set<string> {
  const forest = buildMindMapForest(readElements(doc).items);
  const roots = new Set<string>();
  for (const id of ids) {
    const root = forest.nodes.get(id)?.rootId;
    if (root !== undefined) roots.add(root);
  }
  return roots;
}

/**
 * Раскладывает заново карты, в которых лежат узлы ids (ADR 0011). Вызывается внутри
 * открытой транзакции действия: позиции меняются тем же шагом отмены. Пишутся только
 * изменившиеся координаты.
 */
export function relayoutMindMaps(doc: Y.Doc, ids: Iterable<string>): void {
  const elements = readElements(doc).items;
  const forest = buildMindMapForest(elements);
  const byId = new Map<string, BoardElement>(elements.map((element) => [element.id, element]));
  const records = doc.getMap<unknown>('elements');
  const roots = new Set<string>();
  for (const id of ids) {
    const root = forest.nodes.get(id)?.rootId;
    if (root !== undefined) roots.add(root);
  }
  for (const root of roots) {
    const positions = layoutMindMap(forest, root, (id) => byId.get(id));
    for (const [id, position] of positions) {
      const element = byId.get(id);
      const record = records.get(id);
      if (element === undefined || !(record instanceof Y.Map)) continue;
      if (element.x !== position.x) record.set('x', position.x);
      if (element.y !== position.y) record.set('y', position.y);
    }
  }
}
