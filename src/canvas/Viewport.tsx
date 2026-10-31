import type { ReactNode } from 'react';
import { BACKGROUND_ATTRIBUTE } from './attachPointerEvents';
import type { CameraControls } from './useCameraControls';
import { cx } from '../ui';
import styles from './Viewport.module.css';

interface ViewportProps {
  readonly controls: CameraControls;
  /** Элементы с абсолютными позициями в мировых координатах. */
  readonly children: ReactNode;
  /** Слой под элементами в экранных координатах (например, OverviewCanvas). */
  readonly underlay?: ReactNode;
  readonly background?: 'plain' | 'dots' | 'grid';
}

const backgroundProps = { [BACKGROUND_ATTRIBUTE]: '' };

export function Viewport({ controls, children, underlay, background = 'plain' }: ViewportProps) {
  return (
    <div
      ref={controls.containerRef}
      className={cx(styles.viewport, styles[background])}
      {...backgroundProps}
    >
      {underlay}
      <div ref={controls.layerRef} className={styles.layer} {...backgroundProps}>
        {children}
      </div>
    </div>
  );
}
