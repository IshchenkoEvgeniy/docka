import { memo, useMemo, useSyncExternalStore } from 'react';
import {
  ElementFrame,
  OverviewCanvas,
  intersects,
  useDetailLevel,
  useInteraction,
  useProgressiveMount,
  useRenderRect,
  type CameraControls,
  type InteractionStore,
} from '../../canvas';
import { compareStacking, tagIdsOf, type BoardElement } from '../../core';
import { definitionFor } from '../../elements';
import { cardColorToken } from '../../ui';
import { TagChips } from '../tags';
import type { BoardModel } from './model';
import styles from './Board.module.css';

/** Теги элемента метками под карточкой (не меняют её высоту). */
export function ElementTags({
  element,
  inline = false,
}: {
  readonly element: BoardElement;
  /** В колонке метки идут в потоке, а не поверх следующей карточки. */
  readonly inline?: boolean;
}) {
  if (tagIdsOf(element.tags).length === 0) return null;
  return (
    <div className={inline ? styles.tagInline : styles.tagStrip}>
      <TagChips tags={element.tags} />
    </div>
  );
}

/** Элементы прямо на доске; карточки колонок рисует сама колонка. */
function topLevel(elements: ReadonlyMap<string, BoardElement>): BoardElement[] {
  return [...elements.values()].filter(
    (element) => element.parentId === null || !elements.has(element.parentId),
  );
}

function useBoardElements(model: BoardModel): ReadonlyMap<string, BoardElement> {
  return useSyncExternalStore(model.elements.subscribe, model.elements.getSnapshot);
}

/** Перерисовывается, только когда изменился сам элемент (объект из снимка тот же — memo пропускает). */
const BoardItem = memo(function BoardItem({
  element,
  store,
}: {
  readonly element: BoardElement;
  readonly store: InteractionStore;
}) {
  const { Render, resize } = definitionFor(element.type);
  const editing = useInteraction(store, (state) => state.editingId === element.id);
  return (
    <ElementFrame
      id={element.id}
      rect={element}
      locked={element.locked}
      resize={resize}
      store={store}
    >
      <Render element={element} editing={editing} />
      <ElementTags element={element} />
    </ElementFrame>
  );
});

/** DOM-элементы только рядом с экраном и только на детальном масштабе (ADR 0001). */
export function ElementLayer({
  model,
  controls,
}: {
  readonly model: BoardModel;
  readonly controls: CameraControls;
}) {
  const elements = useBoardElements(model);
  const sorted = useMemo(() => topLevel(elements).sort(compareStacking), [elements]);
  const renderRect = useRenderRect(controls);
  const detail = useDetailLevel(controls);
  const dragged = useInteraction(model.interaction, (state) => state.drag?.ids ?? null);
  const visible = useMemo(() => {
    if (renderRect === null || detail === 'compact') return [];
    // Перетаскиваемое остаётся смонтированным, даже если ушло за край области отрисовки.
    return sorted.filter(
      (element) => intersects(renderRect, element) || dragged?.has(element.id) === true,
    );
  }, [sorted, renderRect, detail, dragged]);
  const visibleIds = useMemo(() => visible.map((element) => element.id), [visible]);
  const mounted = useProgressiveMount(visibleIds);
  return visible
    .filter((element) => mounted.has(element.id))
    .map((element) => <BoardItem key={element.id} element={element} store={model.interaction} />);
}

/** Мелкий масштаб: все элементы одной картинкой. */
export function BoardOverview({
  model,
  controls,
}: {
  readonly model: BoardModel;
  readonly controls: CameraControls;
}) {
  const elements = useBoardElements(model);
  const detail = useDetailLevel(controls);
  const items = useMemo(
    () =>
      topLevel(elements)
        .sort(compareStacking)
        .map((element) => ({ rect: element, fill: cardColorToken(element.color) })),
    [elements],
  );
  return <OverviewCanvas controls={controls} items={items} active={detail === 'compact'} />;
}
