import { useEffect } from 'react';
import { useStore } from 'zustand';
import { imageAsset, useAsset } from '../../elements';
import { t } from '../../i18n';
import { Button } from '../../ui';
import type { BoardModel } from './model';
import styles from './Board.module.css';

function Viewer({ asset, onClose }: { readonly asset: string; readonly onClose: () => void }) {
  const state = useAsset(asset);
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
  return (
    <div
      className={styles.viewer}
      role="dialog"
      aria-modal="true"
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      {state.status === 'ready' ? (
        <img className={styles.viewerImage} src={state.url} alt={t('elements.image.alt')} />
      ) : (
        <p className={styles.viewerMessage}>{t('elements.image.syncing')}</p>
      )}
      <Button className={styles.viewerClose} onClick={onClose}>
        {t('common.close')}
      </Button>
    </div>
  );
}

/** Картинка на весь экран (двойной щелчок или касание выделенной картинки). */
export function ImageViewer({ model }: { readonly model: BoardModel }) {
  const viewingId = useStore(model.overlay, (state) => state.viewingId);
  const element = viewingId === null ? undefined : model.elements.getSnapshot().get(viewingId);
  const asset = element === undefined ? null : imageAsset(element.data);
  if (asset === null) return null;
  return (
    <Viewer
      asset={asset}
      onClose={() => {
        model.overlay.setState({ viewingId: null });
      }}
    />
  );
}
