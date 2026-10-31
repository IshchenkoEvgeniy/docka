import { useEffect } from 'react';
import { useStore } from 'zustand';
import type { BoardElement } from '../../core';
import { definitionFor } from '../../elements';
import { t } from '../../i18n';
import { Button } from '../../ui';
import type { BoardModel } from './model';
import styles from './Board.module.css';

function Viewer({
  element,
  onClose,
}: {
  readonly element: BoardElement;
  readonly onClose: () => void;
}) {
  const { Viewer: Content } = definitionFor(element.type);
  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose]);
  if (Content === null) return null;
  return (
    <div
      className={styles.viewer}
      role="dialog"
      aria-modal="true"
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className={styles.viewerBody}
        onPointerDown={(event) => {
          if (event.target === event.currentTarget) onClose();
        }}
      >
        <Content element={element} />
      </div>
      <Button className={styles.viewerClose} onClick={onClose}>
        {t('common.close')}
      </Button>
    </div>
  );
}

/** Просмотр на весь экран (двойной щелчок или касание выделенного): что показать — решает тип. */
export function ElementViewer({ model }: { readonly model: BoardModel }) {
  const viewingId = useStore(model.overlay, (state) => state.viewingId);
  const element = viewingId === null ? undefined : model.elements.getSnapshot().get(viewingId);
  if (element === undefined) return null;
  return (
    <Viewer
      element={element}
      onClose={() => {
        model.overlay.setState({ viewingId: null });
      }}
    />
  );
}
