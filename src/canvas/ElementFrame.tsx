import type { ReactNode } from 'react';
import { cx } from '../ui';
import { CONNECTOR_HANDLE_ATTRIBUTE, ELEMENT_ID_ATTRIBUTE } from './attachPointerEvents';
import type { Rect } from './geometry';
import type { ResizeMode } from './resize';
import { ResizeHandles } from './ResizeHandles';
import { useInteraction, type InteractionStore } from './interactionStore';
import styles from './ElementFrame.module.css';

interface ElementFrameProps {
  readonly id: string;
  readonly rect: Rect;
  readonly locked: boolean;
  readonly resize: ResizeMode;
  readonly store: InteractionStore;
  readonly children: ReactNode;
  readonly passthrough?: boolean;
}

/**
 * Рамка элемента на холсте: позиция, выделение, ручки размера, предпросмотр перетаскивания.
 * Что внутри — решает тип элемента (children).
 */
export function ElementFrame({
  id,
  rect,
  locked,
  resize,
  store,
  children,
  passthrough = false,
}: ElementFrameProps) {
  const selected = useInteraction(store, (state) => state.selection.has(id));
  const alone = useInteraction(store, (state) => state.selection.size === 1);
  const drag = useInteraction(store, (state) =>
    state.drag?.ids.has(id) === true ? state.drag : null,
  );
  const resized = useInteraction(store, (state) =>
    state.resize?.id === id ? state.resize.rect : null,
  );
  const editing = useInteraction(store, (state) => state.editingId === id);
  const raised = useInteraction(store, (state) => state.drag?.raise.has(id) === true);
  const dropTarget = useInteraction(store, (state) => state.drag?.target === id);
  const shown = resized ?? { ...rect, x: rect.x + (drag?.dx ?? 0), y: rect.y + (drag?.dy ?? 0) };
  // Ширину тянут вручную, а высота растёт вместе с текстом.
  const autoHeight = resize === 'width';
  const showHandles = selected && alone && !locked && !editing && drag === null;
  const connectTarget = useInteraction(store, (state) => state.connecting?.hoverId === id);
  const dimmed = useInteraction(store, (state) => state.highlight?.has(id) === false);
  const attributes = { [ELEMENT_ID_ATTRIBUTE]: id };
  return (
    <div
      {...attributes}
      className={cx(
        styles.frame,
        passthrough && styles.passthrough,
        selected && styles.selected,
        editing && styles.editing,
        locked && styles.locked,
        (drag !== null || raised) && styles.dragging,
        (dropTarget || connectTarget) && styles.dropTarget,
        dimmed && !selected && styles.dimmed,
      )}
      style={{
        // Прозрачная область не создаёт stacking context: её подпись может лежать над карточками.
        ...(passthrough
          ? { left: shown.x, top: shown.y }
          : {
              transform: `translate(${String(shown.x)}px, ${String(shown.y)}px)`,
            }),
        width: shown.width,
        ...(autoHeight ? { minHeight: shown.height } : { height: shown.height }),
      }}
    >
      {children}
      {showHandles && <ResizeHandles mode={resize} rect={shown} active={resized !== null} />}
      {selected && alone && !editing && drag === null && resized === null && (
        <div className={styles.connector} {...{ [CONNECTOR_HANDLE_ATTRIBUTE]: id }} />
      )}
    </div>
  );
}

/** Рамка выделения и направляющие — поверх элементов, в мировых координатах. */
export function InteractionOverlay({ store }: { readonly store: InteractionStore }) {
  const marquee = useInteraction(store, (state) => state.marquee);
  const guides = useInteraction(store, (state) => state.guides);
  return (
    <>
      {marquee !== null && (
        <div
          className={styles.marquee}
          style={{
            transform: `translate(${String(marquee.x)}px, ${String(marquee.y)}px)`,
            width: marquee.width,
            height: marquee.height,
          }}
        />
      )}
      {guides.map((guide) => (
        <div
          key={`${guide.axis}:${String(guide.position)}`}
          className={styles.guide}
          style={
            guide.axis === 'x'
              ? {
                  transform: `translate(${String(guide.position)}px, ${String(guide.from)}px)`,
                  width: 'calc(1px / var(--canvas-zoom, 1))',
                  height: guide.to - guide.from,
                }
              : {
                  transform: `translate(${String(guide.from)}px, ${String(guide.position)}px)`,
                  width: guide.to - guide.from,
                  height: 'calc(1px / var(--canvas-zoom, 1))',
                }
          }
        />
      ))}
    </>
  );
}
