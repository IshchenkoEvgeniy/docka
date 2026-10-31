import type { NewElement } from '../../core';
import {
  ENTITY_ELEMENT_TYPE,
  ENTITY_VIEW_WIDTH,
  definitionFor,
  type EntityView,
} from '../../elements';
import type { ClipboardPayload } from './clipboard';
import type { BoardModel } from './model';

/**
 * Элементы-представления сущностей (ADR 0004). При копировании пользователь выбирает:
 * ссылка на ту же сущность или независимая копия.
 */

/** Сущности этого проекта, на которые ссылаются новые элементы. */
export function referencedEntities(model: BoardModel, elements: readonly NewElement[]): string[] {
  const entities = model.host.entities;
  if (entities === null) return [];
  const ids = elements.flatMap((element) => {
    const id = definitionFor(element.type).entityOf(element.data);
    return id === null || !entities.exists(id) ? [] : [id];
  });
  return [...new Set(ids)];
}

function create(model: BoardModel, elements: readonly NewElement[]): void {
  const result = model.run({ kind: 'createElements', elements });
  if (result?.createdIds !== undefined)
    model.interaction.setState({ selection: new Set(result.createdIds) });
}

/** Создаёт элементы; если среди них ссылки на сущности и ask — сначала спрашивает. */
export function placeElements(
  model: BoardModel,
  elements: readonly NewElement[],
  ask: boolean,
): void {
  if (elements.length === 0) return;
  if (ask && referencedEntities(model, elements).length > 0) {
    model.overlay.setState({ dialog: { kind: 'references', elements } });
    return;
  }
  create(model, elements);
}

/** Независимые копии сущностей и элементы, ссылающиеся на копии, — один шаг отмены. */
export function placeWithCopies(model: BoardModel, elements: readonly NewElement[]): void {
  const entities = model.host.entities;
  if (entities === null) {
    create(model, elements);
    return;
  }
  model.undo.batch(() => {
    const copies = new Map<string, string | null>();
    const copyOf = (id: string): string | null => {
      if (!copies.has(id)) copies.set(id, entities.duplicate(id));
      return copies.get(id) ?? null;
    };
    const mapped = elements.map((element) => {
      const definition = definitionFor(element.type);
      const id = definition.entityOf(element.data);
      const copy = id === null || !entities.exists(id) ? null : copyOf(id);
      const data = copy === null ? null : definition.withEntity(element.data, copy);
      return data === null ? element : { ...element, data };
    });
    create(model, mapped);
  });
}

/** Элемент-представление сущности для перетаскивания из библиотеки и «На доску». */
export function entityPayload(entityId: string, view: EntityView = 'card'): ClipboardPayload {
  const data = { entityId, view };
  const { height } = definitionFor(ENTITY_ELEMENT_TYPE).defaultSize;
  return {
    app: 'doska',
    kind: 'elements',
    version: 1,
    elements: [
      {
        type: ENTITY_ELEMENT_TYPE,
        x: 0,
        y: 0,
        width: ENTITY_VIEW_WIDTH[view],
        height,
        color: 'default',
        tagIds: [],
        data,
      },
    ],
  };
}
