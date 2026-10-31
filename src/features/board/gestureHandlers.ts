import {
  EMPTY_SELECTION,
  pressSelection,
  releaseSelection,
  selectionInRect,
  snapToGrid,
  type DeferredSelection,
  type GestureHandlers,
  type Point,
  type Rect,
  type ResizeHandle,
  type Size,
} from '../../canvas';
import type { BoardElement, ElementId } from '../../core';
import { definitionFor } from '../../elements';
import { activateElement, stopEditing } from './boardActions';
import type { GestureContext, GestureView, HandlersPart } from './gestureContext';
import type { BoardModel } from './model';
import { connectionHandlers } from './connecting';
import { moveHandlers } from './moving';

export type { GestureView } from './gestureContext';

interface ResizeSession {
  readonly element: BoardElement;
  readonly handle: ResizeHandle;
  readonly minSize: Size;
  readonly keepAspect: boolean;
}

function resizedRect(session: ResizeSession, delta: Point, grid: boolean): Rect {
  const { element, handle, minSize } = session;
  if (session.keepAspect) {
    const ratio = element.height / element.width;
    const width = Math.max(minSize.width, minSize.height / ratio, element.width + delta.x);
    return {
      x: element.x,
      y: element.y,
      width: Math.round(width),
      height: Math.round(width * ratio),
    };
  }
  const horizontal = handle !== 's';
  const vertical = handle !== 'e';
  let width = horizontal ? element.width + delta.x : element.width;
  let height = vertical ? element.height + delta.y : element.height;
  if (grid && horizontal) width = snapToGrid(element.x + width) - element.x;
  if (grid && vertical) height = snapToGrid(element.y + height) - element.y;
  return {
    x: element.x,
    y: element.y,
    width: Math.round(Math.max(minSize.width, width)),
    height: Math.round(Math.max(minSize.height, height)),
  };
}

function selectionHandlers({
  model,
  view,
  selection,
}: GestureContext): HandlersPart<
  'pressElement' | 'releaseElement' | 'clickBackground' | 'openMenu'
> {
  const { interaction } = model;
  let deferred: DeferredSelection = 'none';
  let wasAlone = false;
  return {
    pressElement: (id, additive) => {
      const before = selection();
      wasAlone = before.size === 1 && before.has(id);
      if (interaction.getState().editingId !== id) stopEditing(model);
      const result = pressSelection(before, id, additive);
      deferred = result.deferred;
      interaction.setState({ selection: result.selection, connectionSelection: EMPTY_SELECTION });
    },
    releaseElement: (id, kind) => {
      interaction.setState({ selection: releaseSelection(selection(), id, deferred) });
      deferred = 'none';
      // Двойной клик или касание уже выделенного элемента — правка текста.
      if (kind === 'doubleClick' || (kind === 'tap' && wasAlone)) activateElement(model, id);
    },
    clickBackground: () => {
      stopEditing(model);
      interaction.setState({ selection: EMPTY_SELECTION, connectionSelection: EMPTY_SELECTION });
    },
    openMenu: (target, screen) => {
      stopEditing(model);
      if (target.kind === 'connection')
        interaction.setState({
          selection: EMPTY_SELECTION,
          connectionSelection: new Set([target.id]),
        });
      else if (target.kind !== 'background' && !selection().has(target.id))
        interaction.setState({
          selection: new Set([target.id]),
          connectionSelection: EMPTY_SELECTION,
        });
      view.openMenu(target, screen);
    },
  };
}

function resizeHandlers({
  model,
  gridSnap,
}: GestureContext): HandlersPart<'startResize' | 'updateResize' | 'endResize'> {
  const { interaction } = model;
  let resize: ResizeSession | null = null;
  return {
    startResize: (id, handle) => {
      const element = model.elements.getSnapshot().get(id);
      if (element === undefined || element.locked) return false;
      if (interaction.getState().editingId !== id) stopEditing(model);
      const definition = definitionFor(element.type);
      resize = {
        element,
        handle,
        minSize: definition.minSize,
        keepAspect: definition.resize === 'aspect',
      };
      interaction.setState({ resize: { id, rect: element } });
      return true;
    },
    updateResize: (delta) => {
      if (resize === null) return;
      const rect = resizedRect(resize, delta, gridSnap());
      interaction.setState({ resize: { id: resize.element.id, rect } });
    },
    endResize: (commit) => {
      const preview = interaction.getState().resize;
      if (commit && resize !== null && preview !== null) {
        const { x, y, width, height } = preview.rect;
        const elementId: ElementId = resize.element.id;
        if (width !== resize.element.width || height !== resize.element.height)
          model.run({ kind: 'resizeElement', elementId, placement: { x, y, width, height } });
        // Другая ширина — другие переносы строк: высоту текста надо перемерить.
        model.markForMeasure([elementId]);
      }
      resize = null;
      interaction.setState({ resize: null });
    },
  };
}

function marqueeHandlers({
  model,
  selection,
}: GestureContext): HandlersPart<'updateMarquee' | 'endMarquee'> {
  const { interaction } = model;
  let base: ReadonlySet<string> | null = null;
  return {
    updateMarquee: (rect, additive) => {
      if (base === null) {
        stopEditing(model);
        interaction.setState({ connectionSelection: EMPTY_SELECTION });
      }
      base ??= additive ? selection() : EMPTY_SELECTION;
      // Карточки в колонке хранят не координаты, а порядок: рамкой выделяется только верхний уровень.
      const items = [...model.elements.getSnapshot().values()]
        .filter((element) => element.parentId === null)
        .map((element) => ({ id: element.id, rect: element }));
      interaction.setState({ marquee: rect, selection: selectionInRect(items, rect, base) });
    },
    endMarquee: () => {
      base = null;
      interaction.setState({ marquee: null });
    },
  };
}

/** Жесты холста → выделение, предпросмотр и команды доски. */
export function createGestureHandlers(model: BoardModel, view: GestureView): GestureHandlers {
  const context: GestureContext = {
    model,
    view,
    selection: () => model.interaction.getState().selection,
    gridSnap: () => model.settings.getState().gridSnap,
  };
  return {
    ...selectionHandlers(context),
    ...moveHandlers(context),
    ...resizeHandlers(context),
    ...marqueeHandlers(context),
    ...connectionHandlers(context),
  };
}
