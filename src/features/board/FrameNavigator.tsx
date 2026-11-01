import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { boundsOf, fitBounds, useInteraction, type CameraControls } from '../../canvas';
import { plainToRichText, type BoardElement } from '../../core';
import { definitionFor } from '../../elements';
import { t } from '../../i18n';
import { Button, Icon, cx } from '../../ui';
import { stopEditing } from './boardActions';
import type { BoardModel } from './model';
import { selectedElements } from './boardActions';
import { viewSize, worldPoint } from './view';
import styles from './FrameNavigator.module.css';

/** Обвести выделенное или создать пустую зону в центре видимой части доски. */
function addFrame(model: BoardModel, controls: CameraControls): void {
  const elements = model.elements.getSnapshot();
  const selected = selectedElements(model).map((item) =>
    item.parentId === null ? item : (elements.get(item.parentId) ?? item),
  );
  const bounds = boundsOf(selected);
  const center = worldPoint(controls, null);
  const { defaultSize: size, minSize } = definitionFor('frame');
  const placement =
    bounds === null
      ? {
          x: Math.round(center.x - size.width / 2),
          y: Math.round(center.y - size.height / 2),
          ...size,
        }
      : {
          x: bounds.x - 32,
          y: bounds.y - 32,
          width: Math.max(minSize.width, bounds.width + 64),
          height: Math.max(minSize.height, bounds.height + 64),
        };
  const result = model.run({
    kind: 'createElement',
    type: 'frame',
    placement,
    data: {},
    richText: plainToRichText(''),
  });
  if (result?.createdId !== undefined)
    model.interaction.setState({
      selection: new Set([result.createdId]),
      editingId: result.createdId,
    });
}

function visitFrame(model: BoardModel, controls: CameraControls, frame: BoardElement): void {
  const size = viewSize(controls);
  if (size === null) return;
  stopEditing(model);
  // Панель закрывается при переходе, поэтому рамка получает всю доступную ширину.
  const camera = fitBounds(frame, { ...size, height: Math.max(1, size.height - 80) });
  controls.controller.setCamera({ ...camera, offsetY: camera.offsetY + 80 });
  model.interaction.setState({ selection: new Set([frame.id]) });
}

/** Список геометрических зон: работает и для рамок вне текущего экрана. */
export function FrameNavigator({
  model,
  controls,
}: {
  readonly model: BoardModel;
  readonly controls: CameraControls;
}) {
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLElement>(null);
  const close = (): void => {
    setOpen(false);
    trigger.current?.focus();
  };
  useEffect(() => {
    if (open)
      (
        panel.current?.querySelector<HTMLButtonElement>('ol button') ??
        panel.current?.querySelector<HTMLButtonElement>('button')
      )?.focus();
  }, [open]);
  const elements = useSyncExternalStore(model.elements.subscribe, model.elements.getSnapshot);
  const selected = useInteraction(model.interaction, (state) => state.selection);
  const frames = [...elements.values()]
    .filter((item) => definitionFor(item.type).region)
    .sort((a, b) => a.y - b.y || a.x - b.x || a.id.localeCompare(b.id));
  const root = controls.containerRef.current?.parentElement?.parentElement;
  return (
    <>
      <Button
        ref={trigger}
        pressed={open}
        aria-expanded={open}
        aria-controls="board-frames"
        onClick={() => {
          stopEditing(model);
          setOpen(!open);
        }}
      >
        {t('frames.title')}
      </Button>
      {open &&
        root !== undefined &&
        root !== null &&
        createPortal(
          <aside
            ref={panel}
            id="board-frames"
            aria-label={t('frames.title')}
            className={styles.panel}
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                event.stopPropagation();
                close();
              }
            }}
          >
            <div className={styles.header}>
              <h2>
                {t('frames.title')} <span>{frames.length}</span>
              </h2>
              <Button
                variant="ghost"
                aria-label={t('common.close')}
                onClick={() => {
                  close();
                }}
              >
                ×
              </Button>
            </div>
            <p className={styles.hint}>{t('frames.hint')}</p>
            {frames.length === 0 && <p className={styles.empty}>{t('frames.empty')}</p>}
            <ol className={styles.list}>
              {frames.map((frame, index) => (
                <li key={frame.id}>
                  <button
                    type="button"
                    className={cx(styles.row, selected.has(frame.id) && styles.active)}
                    aria-current={selected.has(frame.id) ? 'true' : undefined}
                    onClick={() => {
                      visitFrame(model, controls, frame);
                      close();
                    }}
                  >
                    <Icon name="frame" size={18} />
                    <span>
                      {definitionFor(frame.type)
                        .toPlainText(frame, model.richTextOf(frame.id))
                        .trim() || t('frames.unnamed', { number: index + 1 })}
                    </span>
                  </button>
                </li>
              ))}
            </ol>
            <Button
              onClick={() => {
                addFrame(model, controls);
                close();
              }}
            >
              {t(selected.size > 0 ? 'frames.wrap' : 'frames.add')}
            </Button>
            <p className={styles.hint}>{t('frames.deleteHint')}</p>
          </aside>,
          root,
        )}
    </>
  );
}
