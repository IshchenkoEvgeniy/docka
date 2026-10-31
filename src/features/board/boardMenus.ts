import type { CameraControls, Point, PointerTarget } from '../../canvas';
import type { MenuEntry } from '../../ui';
import { addMenuEntries, type AddPickers } from './addMenu';
import { boardMenuEntries } from './menuEntries';
import type { BoardModel } from './model';
import { fitAll, viewSize, worldPoint } from './view';

/** Открытое меню: по правой кнопке/долгому нажатию на холсте или с кнопки панели. */
export type MenuState =
  | { readonly kind: 'context'; readonly target: PointerTarget; readonly screen: Point }
  | { readonly kind: 'add' | 'actions'; readonly client: Point };

function clientPoint(controls: CameraControls, point: Point): Point {
  const rect = controls.containerRef.current?.getBoundingClientRect();
  return rect === undefined ? point : { x: rect.left + point.x, y: rect.top + point.y };
}

/** «Действия» с панели: меню того, что выделено (стрелки или элемента). */
function selectionTarget(model: BoardModel): PointerTarget {
  const { selection, connectionSelection } = model.interaction.getState();
  const [connection] = connectionSelection;
  if (connection !== undefined) return { kind: 'connection', id: connection };
  const [element] = selection;
  return element === undefined ? { kind: 'background' } : { kind: 'element', id: element };
}

export function menuContent(
  state: MenuState,
  model: BoardModel,
  controls: CameraControls,
  pickers: AddPickers,
): { readonly position: Point; readonly entries: MenuEntry[] } {
  const fit = (): void => {
    fitAll(model, controls);
  };
  if (state.kind === 'context')
    return {
      position: clientPoint(controls, state.screen),
      entries: boardMenuEntries({
        model,
        target: state.target,
        at: worldPoint(controls, state.screen),
        fitAll: fit,
      }),
    };
  // С панели новое кладётся в центр экрана.
  const size = viewSize(controls);
  const center = worldPoint(
    controls,
    size === null ? null : { x: size.width / 2, y: size.height / 2 },
  );
  if (state.kind === 'add')
    return { position: state.client, entries: addMenuEntries(model, center, pickers) };
  return {
    position: state.client,
    entries: boardMenuEntries({ model, target: selectionTarget(model), at: center, fitAll: fit }),
  };
}
