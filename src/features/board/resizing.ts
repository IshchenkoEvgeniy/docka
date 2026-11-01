import { GRID_SIZE, resizeHandles, resizeRect, type Rect, type ResizeHandle } from '../../canvas';
import type { BoardElement } from '../../core';
import { definitionFor } from '../../elements';
import { stopEditing } from './boardActions';
import type { GestureContext, HandlersPart } from './gestureContext';
import type { BoardModel } from './model';

interface ResizeSession {
  readonly element: BoardElement;
  readonly handle: ResizeHandle;
}

function commitResize(model: BoardModel, original: BoardElement, rect: Rect): void {
  const { x, y, width, height } = rect;
  if (
    x !== original.x ||
    y !== original.y ||
    width !== original.width ||
    height !== original.height
  )
    model.run({
      kind: 'resizeElement',
      elementId: original.id,
      placement: { x, y, width, height },
    });
  // Другая ширина меняет переносы строк и автоматическую высоту текста.
  model.markForMeasure([original.id]);
}

export function resizeHandlers({
  model,
  gridSnap,
}: GestureContext): HandlersPart<'startResize' | 'updateResize' | 'endResize'> {
  const { interaction } = model;
  let session: ResizeSession | null = null;
  return {
    startResize: (id, handle) => {
      const element = model.elements.getSnapshot().get(id);
      if (element === undefined || element.locked) return false;
      if (!resizeHandles(definitionFor(element.type).resize).includes(handle)) return false;
      stopEditing(model);
      session = { element, handle };
      interaction.setState({ resize: { id, rect: element } });
      return true;
    },
    updateResize: (delta, modifiers) => {
      if (session === null) return;
      const { element, handle } = session;
      const definition = definitionFor(element.type);
      const rect = resizeRect(element, handle, delta, {
        mode: definition.resize,
        minSize: definition.minSize,
        grid: gridSnap() ? GRID_SIZE : null,
        ...modifiers,
      });
      interaction.setState({ resize: { id: element.id, rect } });
    },
    endResize: (commit) => {
      const preview = interaction.getState().resize;
      if (commit && session !== null && preview !== null)
        commitResize(model, session.element, preview.rect);
      session = null;
      interaction.setState({ resize: null });
    },
  };
}
