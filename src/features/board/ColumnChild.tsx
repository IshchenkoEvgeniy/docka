import { memo } from 'react';
import { ELEMENT_ID_ATTRIBUTE, useInteraction } from '../../canvas';
import type { BoardElement } from '../../core';
import { definitionFor } from '../../elements';
import { cx } from '../../ui';
import { ElementTags } from './ElementLayer';
import type { BoardModel } from './model';
import styles from './Board.module.css';

/** Карточка внутри колонки: выделяется, тянется и правится так же, как на доске. */
export function createChildView(model: BoardModel) {
  const store = model.interaction;
  return memo(function ColumnChild({ element }: { readonly element: BoardElement }) {
    const selected = useInteraction(store, (state) => state.selection.has(element.id));
    const editing = useInteraction(store, (state) => state.editingId === element.id);
    const dimmed = useInteraction(store, (state) => state.highlight?.has(element.id) === false);
    const drag = useInteraction(store, (state) =>
      state.drag?.ids.has(element.id) === true ? state.drag : null,
    );
    const { Render } = definitionFor(element.type);
    const attributes = { [ELEMENT_ID_ATTRIBUTE]: element.id };
    return (
      <div
        {...attributes}
        className={cx(
          styles.child,
          selected && styles.childSelected,
          drag !== null && styles.childDragging,
          dimmed && !selected && styles.childDimmed,
        )}
        style={
          drag === null
            ? undefined
            : { transform: `translate(${String(drag.dx)}px, ${String(drag.dy)}px)` }
        }
      >
        <Render element={element} editing={editing} />
        <ElementTags element={element} inline />
      </div>
    );
  });
}
