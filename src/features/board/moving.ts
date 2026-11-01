import {
  GRID_SIZE,
  SNAP_THRESHOLD_PX,
  boundsOf,
  containsPoint,
  expandRect,
  intersects,
  snapMove,
  type Point,
  type Rect,
} from '../../canvas';
import type { BoardElement, ElementId } from '../../core';
import { compareInColumn, definitionFor, withRegionContents } from '../../elements';
import { t } from '../../i18n';
import { runMoves } from './runMoves';
import { stopEditing } from './boardActions';
import type { GestureContext, HandlersPart } from './gestureContext';
import type { BoardModel } from './model';

interface MoveSession {
  readonly regional: boolean;
  readonly ids: ReadonlySet<string>;
  readonly start: readonly BoardElement[];
  /** Где элементы были на экране в начале (у карточек в колонке — по DOM). */
  readonly rects: ReadonlyMap<string, Rect>;
  readonly bounds: Rect;
  readonly others: readonly Rect[];
  /** Колонки, куда можно положить перетаскиваемое (сами колонки в колонки не кладутся). */
  readonly columns: readonly { readonly id: string; readonly rect: Rect }[];
  /** Контейнеры, которые надо поднять над соседями, пока из них тянут карточку. */
  readonly raise: ReadonlySet<string>;
}

const isContainer = (element: BoardElement) => definitionFor(element.type).container;
const ORDER_STEP = 16;

/** Соседи для прилипания: верхний уровень и только около экрана. */
function neighbours(model: BoardModel, exclude: ReadonlySet<string>, view: Rect | null): Rect[] {
  const area = view === null ? null : expandRect(view, 0.5);
  return [...model.elements.getSnapshot().values()].filter(
    (element) =>
      element.parentId === null &&
      !exclude.has(element.id) &&
      (area === null || intersects(area, element)),
  );
}

function startSession({ model, view, selection }: GestureContext): MoveSession | null {
  const snapshot = model.elements.getSnapshot();
  const picked = [...selection()]
    .map((id) => snapshot.get(id))
    .filter((element): element is BoardElement => element !== undefined && !element.locked);
  const expanded = withRegionContents(snapshot, picked);
  if (expanded.some((element) => element.locked)) {
    model.showNotice(t('frames.lockedContent'));
    return null;
  }
  const regional = picked.some((element) => definitionFor(element.type).region);
  const pickedIds = new Set(expanded.map((element) => element.id));
  // Карточка едет вместе со своей колонкой — отдельно её двигать не нужно.
  const start = expanded.filter(
    (element) => element.parentId === null || !pickedIds.has(element.parentId),
  );
  const rects = new Map(
    start.map((element) => [
      element.id,
      element.parentId === null ? element : (view.measure(element.id) ?? element),
    ]),
  );
  const bounds = boundsOf(rects.values());
  if (bounds === null) return null;
  const ids = new Set(start.map((element) => element.id));
  const columns =
    !regional && start.some((element) => !isContainer(element))
      ? [...snapshot.values()]
          .filter(
            (element) => isContainer(element) && element.parentId === null && !ids.has(element.id),
          )
          .map((element) => ({ id: element.id, rect: view.measure(element.id) ?? element }))
      : [];
  const raise = new Set(
    start.flatMap((element) => (element.parentId === null ? [] : [element.parentId])),
  );
  return {
    regional,
    ids,
    start,
    rects,
    bounds,
    others: neighbours(model, ids, view.getVisibleRect()),
    columns,
    raise,
  };
}

function center(rect: Rect): Point {
  return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
}

function dropTarget(session: MoveSession, dx: number, dy: number): string | null {
  const moved = center({ ...session.bounds, x: session.bounds.x + dx, y: session.bounds.y + dy });
  return session.columns.find((column) => containsPoint(column.rect, moved))?.id ?? null;
}

interface Placement {
  readonly elementId: ElementId;
  readonly x: number;
  readonly y: number;
  readonly parentId: ElementId | null;
}

/** Новый порядок карточек колонки: брошенные встают по своей высоте среди оставшихся. */
function intoColumn(
  model: BoardModel,
  context: GestureContext,
  session: MoveSession,
  columnId: ElementId,
  dropped: readonly { element: BoardElement; rect: Rect }[],
): Placement[] {
  const staying = [...model.elements.getSnapshot().values()]
    .filter((element) => element.parentId === columnId && !session.ids.has(element.id))
    .sort(compareInColumn)
    .map((element) => ({ element, y: center(context.view.measure(element.id) ?? element).y }));
  const incoming = dropped.map(({ element, rect }) => ({ element, y: center(rect).y }));
  const ordered = [...staying, ...incoming].sort((a, b) => a.y - b.y);
  return ordered.map(({ element }, index) => ({
    elementId: element.id,
    x: 0,
    y: (index + 1) * ORDER_STEP,
    parentId: columnId,
  }));
}

/** Куда легли элементы: в колонку, из колонки на доску или просто на новое место. */
function placementsAfterDrop(
  context: GestureContext,
  session: MoveSession,
  dx: number,
  dy: number,
) {
  const { model } = context;
  const finals = session.start.map((element) => {
    const rect = session.rects.get(element.id) ?? element;
    return { element, rect: { ...rect, x: Math.round(rect.x + dx), y: Math.round(rect.y + dy) } };
  });
  const target = dropTarget(session, dx, dy) as ElementId | null; // id колонки из снимка доски
  const free = finals.filter(({ element }) => target === null || isContainer(element));
  const dropped = finals.filter(({ element }) => target !== null && !isContainer(element));
  const placements: Placement[] = free.map(({ element, rect }) => ({
    elementId: element.id,
    x: rect.x,
    y: rect.y,
    parentId: null,
  }));
  if (target !== null) placements.push(...intoColumn(model, context, session, target, dropped));
  const touched = [target, ...session.start.map((element) => element.parentId)];
  return { placements, touched: touched.filter((id): id is ElementId => id !== null) };
}

function commitPlacements(
  model: BoardModel,
  regional: boolean,
  placements: readonly Placement[],
): void {
  if (regional)
    runMoves(
      model,
      placements.map((item) => ({ id: item.elementId, x: item.x, y: item.y })),
      'regionDrop',
    );
  else model.run({ kind: 'placeElements', placements });
}

export function moveHandlers(
  context: GestureContext,
): HandlersPart<'startMove' | 'updateMove' | 'endMove'> {
  const { model, view, gridSnap } = context;
  const { interaction } = model;
  let move: MoveSession | null = null;
  return {
    startMove: () => {
      stopEditing(model);
      move = startSession(context);
      if (move !== null)
        interaction.setState({
          drag: { ids: move.ids, dx: 0, dy: 0, raise: move.raise, target: null },
        });
      return move !== null;
    },
    updateMove: (delta) => {
      if (move === null) return;
      const moved = { ...move.bounds, x: move.bounds.x + delta.x, y: move.bounds.y + delta.y };
      const threshold = SNAP_THRESHOLD_PX / view.getCamera().zoom;
      const snap = snapMove(moved, move.others, threshold, gridSnap() ? GRID_SIZE : null);
      const dx = Math.round(delta.x + snap.dx);
      const dy = Math.round(delta.y + snap.dy);
      const target = dropTarget(move, dx, dy);
      interaction.setState({
        drag: { ids: move.ids, dx, dy, raise: move.raise, target },
        guides: snap.guides,
      });
    },
    endMove: (commit) => {
      const drag = interaction.getState().drag;
      if (commit && move !== null && drag !== null) {
        const intoContainer =
          drag.target !== null || move.start.some((element) => element.parentId !== null);
        if (drag.dx !== 0 || drag.dy !== 0 || intoContainer) {
          const { placements, touched } = placementsAfterDrop(context, move, drag.dx, drag.dy);
          commitPlacements(model, move.regional, placements);
          model.markForMeasure(touched);
        }
      }
      move = null;
      interaction.setState({ drag: null, guides: [] });
    },
  };
}
