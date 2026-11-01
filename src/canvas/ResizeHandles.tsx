import { t } from '../i18n';
import { RESIZE_HANDLE_ATTRIBUTE } from './attachPointerEvents';
import type { Rect } from './geometry';
import { resizeHandles, type ResizeMode } from './resize';
import styles from './ElementFrame.module.css';

interface Props {
  readonly mode: ResizeMode;
  readonly rect: Rect;
  readonly active: boolean;
}

export function ResizeHandles({ mode, rect, active }: Props) {
  return (
    <>
      {resizeHandles(mode).map((handle) => (
        <div
          key={handle}
          className={styles.handle}
          title={t(`canvas.resize.${handle}`)}
          {...{ [RESIZE_HANDLE_ATTRIBUTE]: handle }}
        />
      ))}
      {active && (
        <output className={styles.dimensions}>
          {t(mode === 'width' ? 'canvas.resize.width' : 'canvas.resize.dimensions', {
            width: Math.round(rect.width),
            height: Math.round(rect.height),
          })}
        </output>
      )}
    </>
  );
}
