import { EMPTY_SELECTION, containsPoint, type Point } from '../../canvas';
import { compareStacking, type ConnectionId, type ElementId, type Endpoint } from '../../core';
import { stopEditing } from './boardActions';
import type { GestureContext, HandlersPart } from './gestureContext';

/** Стрелка короче этого и не к элементу — случайное касание кружка, не создаётся. */
const MIN_FREE_LENGTH = 30;

/** Верхний элемент верхнего уровня под точкой (кроме from). */
export function elementAt(
  context: GestureContext,
  point: Point,
  exceptId: string,
): ElementId | null {
  const elements = [...context.model.elements.getSnapshot().values()]
    .filter((element) => element.parentId === null && element.id !== exceptId)
    .sort(compareStacking)
    .reverse();
  const hit = elements.find((element) =>
    containsPoint(context.view.measure(element.id) ?? element, point),
  );
  return hit?.id ?? null;
}

/** Создаёт стрелку от элемента к элементу под точкой или к самой точке. */
function finishConnection(context: GestureContext, fromId: string, point: Point): void {
  const { model } = context;
  const from = model.elements.getSnapshot().get(fromId);
  if (from === undefined) return;
  const hoverId = elementAt(context, point, fromId);
  const fromCenter = { x: from.x + from.width / 2, y: from.y + from.height / 2 };
  if (
    hoverId === null &&
    Math.hypot(point.x - fromCenter.x, point.y - fromCenter.y) < MIN_FREE_LENGTH
  )
    return;
  const to: Endpoint =
    hoverId === null
      ? { kind: 'point', x: Math.round(point.x), y: Math.round(point.y) }
      : { kind: 'element', elementId: hoverId, side: 'auto' };
  const result = model.run({
    kind: 'createConnection',
    from: { kind: 'element', elementId: from.id, side: 'auto' },
    to,
    style: { lineStyle: 'curved', endMarker: 'arrow' },
  });
  if (result?.createdId !== undefined)
    model.interaction.setState({
      selection: EMPTY_SELECTION,
      connectionSelection: new Set([result.createdId as ConnectionId]), // id новой стрелки
    });
}

export function connectionHandlers(
  context: GestureContext,
): HandlersPart<'pressConnection' | 'startConnect' | 'updateConnect' | 'endConnect'> {
  const { model } = context;
  const { interaction } = model;
  return {
    pressConnection: (id) => {
      stopEditing(model);
      interaction.setState({ selection: EMPTY_SELECTION, connectionSelection: new Set([id]) });
    },
    startConnect: (fromId) => {
      stopEditing(model);
      const from = model.elements.getSnapshot().get(fromId);
      if (from === undefined) return;
      const to = { x: from.x + from.width, y: from.y + from.height / 2 };
      interaction.setState({ connecting: { from: fromId, to, hoverId: null } });
    },
    updateConnect: (point) => {
      const connecting = interaction.getState().connecting;
      if (connecting === null) return;
      const hoverId = elementAt(context, point, connecting.from);
      interaction.setState({ connecting: { ...connecting, to: point, hoverId } });
    },
    endConnect: (commit, point) => {
      const connecting = interaction.getState().connecting;
      interaction.setState({ connecting: null });
      if (commit && connecting !== null) finishConnection(context, connecting.from, point);
    },
  };
}
