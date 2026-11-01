import {
  EMPTY_SELECTION,
  pressSelection,
  releaseSelection,
  selectionInRect,
  type DeferredSelection,
  type GestureHandlers,
} from '../../canvas';
import { definitionFor, encloses } from '../../elements';
import { activateElement, stopEditing } from './boardActions';
import type { GestureContext, GestureView, HandlersPart } from './gestureContext';
import type { BoardModel } from './model';
import { connectionHandlers } from './connecting';
import { moveHandlers } from './moving';
import { resizeHandlers } from './resizing';

export type { GestureView } from './gestureContext';

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
        .filter(
          (element) =>
            element.parentId === null &&
            (!definitionFor(element.type).region || encloses(rect, element)),
        )
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
