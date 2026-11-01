import { useRef, useState, type ComponentPropsWithRef } from 'react';
import { createPortal } from 'react-dom';
import type { CameraControls } from '../../canvas';
import { t, type TranslationKey } from '../../i18n';
import { Icon, cx, type IconName } from '../../ui';
import type { AddPickers } from './addMenu';
import type { BoardModel } from './model';
import { CARD_TOOLS, FILE_TOOLS, type PaletteTool } from './paletteTools';
import { TrashDialog } from './TrashDialog';
import { usePaletteDrag, type PaletteGhost } from './usePaletteDrag';
import { useTrashDrop } from './useTrashDrop';
import styles from './Palette.module.css';

interface PaletteButtonProps extends ComponentPropsWithRef<'button'> {
  readonly icon: IconName;
  readonly label: TranslationKey;
  readonly accent?: boolean;
}

function PaletteButton({ icon, label, accent = false, className, ...rest }: PaletteButtonProps) {
  return (
    <button type="button" className={cx(styles.tool, className)} {...rest}>
      <span className={cx(styles.toolIcon, accent && styles.toolIconAccent)}>
        <Icon name={icon} />
      </span>
      <span className={styles.toolLabel}>{t(label)}</span>
    </button>
  );
}

/** Значок под пальцем, пока его несут на доску. */
function Ghost({ ghost }: { readonly ghost: PaletteGhost }) {
  return createPortal(
    <div
      className={cx(styles.ghost, ghost.overCanvas && styles.ghostOverCanvas)}
      style={{ left: ghost.client.x, top: ghost.client.y }}
      aria-hidden="true"
    >
      <Icon name={ghost.tool.icon} />
      <span>{t(ghost.tool.label)}</span>
    </div>,
    document.body,
  );
}

/**
 * Панель элементов слева (на телефоне — снизу), как в Milanote: значок тянут на доску или
 * в колонку, нажатие кладёт элемент в центр экрана. Внизу — корзина: бросить карточку —
 * удалить, нажать — вернуть удалённое.
 */
export function ElementPalette({
  model,
  controls,
  pickers,
  onMore,
}: {
  readonly model: BoardModel;
  readonly controls: CameraControls;
  readonly pickers: AddPickers;
  /** «Ещё»: меню со всеми видами элементов. */
  readonly onMore: (anchor: DOMRect) => void;
}) {
  const { ghost, handlers } = usePaletteDrag(model, controls, pickers);
  const trashRef = useRef<HTMLButtonElement>(null);
  const overTrash = useTrashDrop(model, controls, trashRef);
  const [trashOpen, setTrashOpen] = useState(false);
  const button = (tool: PaletteTool) => (
    <PaletteButton
      key={tool.id}
      icon={tool.icon}
      label={tool.label}
      accent={tool.id === 'board'}
      title={t('board.palette.dragHint')}
      {...handlers(tool)}
    />
  );
  return (
    <nav className={styles.palette} aria-label={t('board.palette.title')}>
      {CARD_TOOLS.map(button)}
      <PaletteButton
        icon="more"
        label="board.palette.more"
        aria-haspopup="menu"
        onClick={(event) => {
          onMore(event.currentTarget.getBoundingClientRect());
        }}
      />
      <span className={styles.separator} />
      {FILE_TOOLS.map(button)}
      <PaletteButton
        ref={trashRef}
        icon="trash"
        label="board.palette.trash"
        className={cx(styles.trash, overTrash && styles.trashOver)}
        title={t('board.trash.dropHint')}
        onClick={() => {
          setTrashOpen(true);
        }}
      />
      {ghost !== null && <Ghost ghost={ghost} />}
      {trashOpen && (
        <TrashDialog
          model={model}
          onClose={() => {
            setTrashOpen(false);
          }}
        />
      )}
    </nav>
  );
}
