import { memo } from 'react';
import type * as Y from 'yjs';
import type { BoardElement } from '../../core';
import { textOf, type AssetStore, type BoardElementsStore } from '../../data';
import { definitionFor, type BoardDirectory, type ElementRuntime } from '../../elements';
import styles from './Gallery.module.css';

const ignore = (): void => undefined;

/** Карточка внутри колонки на превью: только вид, без выделения и перетаскивания. */
const PreviewChild = memo(function PreviewChild({ element }: { readonly element: BoardElement }) {
  const { Render } = definitionFor(element.type);
  return (
    <div className={styles.previewChild}>
      <Render element={element} editing={false} />
    </div>
  );
});

/**
 * Связь элементов с доской для превью на экране досок: только чтение. Элементы рисуются
 * своими же компонентами (вид совпадает с доской), но ничего не пишут и не правятся.
 */
export function createPreviewRuntime(source: {
  readonly doc: Y.Doc;
  readonly elements: BoardElementsStore;
  readonly assets: AssetStore | null;
  readonly boards: BoardDirectory | null;
}): ElementRuntime {
  return {
    textOf: (elementId) => textOf(source.doc, elementId),
    ensureText: () => null,
    stopEditing: ignore,
    fullscreenEditing: false,
    undo: ignore,
    redo: ignore,
    assets: source.assets,
    boards: source.boards,
    elements: source.elements,
    ChildView: PreviewChild,
    updateData: ignore,
    openAsset: null,
    openUrl: ignore,
    refresh: ignore,
    reportHeight: ignore,
  };
}
