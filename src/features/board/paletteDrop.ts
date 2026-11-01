import { ELEMENT_ID_ATTRIBUTE, type CameraControls, type Point } from '../../canvas';
import type { BoardElement } from '../../core';
import { compareInColumn, definitionFor } from '../../elements';
import type { ColumnSlot } from './boardActions';
import type { BoardModel } from './model';
import { measureElement, worldPoint } from './view';

const ORDER_STEP = 16;

/** Точка экрана (clientX/Y) в координатах холста; null — вне холста. */
export function canvasPoint(controls: CameraControls, client: Point): Point | null {
  const container = controls.containerRef.current;
  if (container === null) return null;
  const box = container.getBoundingClientRect();
  const inside =
    client.x >= box.left && client.x <= box.right && client.y >= box.top && client.y <= box.bottom;
  return inside ? worldPoint(controls, { x: client.x - box.left, y: client.y - box.top }) : null;
}

/** Колонка под точкой экрана: сама колонка или колонка карточки под точкой. */
export function columnAt(model: BoardModel, client: Point): BoardElement | null {
  const snapshot = model.elements.getSnapshot();
  for (const node of document.elementsFromPoint(client.x, client.y)) {
    const id = node.closest(`[${ELEMENT_ID_ATTRIBUTE}]`)?.getAttribute(ELEMENT_ID_ATTRIBUTE);
    const element = id === null || id === undefined ? undefined : snapshot.get(id);
    if (element === undefined) continue;
    if (definitionFor(element.type).container) return element;
    const parent = element.parentId === null ? undefined : snapshot.get(element.parentId);
    if (parent !== undefined && definitionFor(parent.type).container) return parent;
  }
  return null;
}

/** Ключ порядка между соседями по высоте точки: карточка встаёт туда, куда её бросили. */
export function columnSlot(
  model: BoardModel,
  controls: CameraControls,
  column: BoardElement,
  at: Point,
): ColumnSlot {
  const children = [...model.elements.getSnapshot().values()]
    .filter((element) => element.parentId === column.id)
    .sort(compareInColumn);
  const centerY = (element: BoardElement) => {
    const rect = measureElement(controls, element.id) ?? element;
    return rect.y + rect.height / 2;
  };
  const index = children.findIndex((child) => centerY(child) > at.y);
  const before = index === -1 ? children.at(-1) : children[index - 1];
  const after = index === -1 ? undefined : children[index];
  const order =
    after === undefined
      ? (before?.y ?? 0) + ORDER_STEP
      : before === undefined
        ? after.y - ORDER_STEP
        : (before.y + after.y) / 2;
  return { columnId: column.id, order };
}
