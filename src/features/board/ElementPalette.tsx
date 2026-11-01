import type { CameraControls } from '../../canvas';
import { t, type TranslationKey } from '../../i18n';
import { Icon, cx, type IconName } from '../../ui';
import type { AddPickers } from './addMenu';
import type { BoardModel } from './model';
import { CARD_TOOLS, FILE_TOOLS, type PaletteTool } from './paletteTools';
import { worldPoint } from './view';
import styles from './Palette.module.css';

function PaletteButton({
  icon,
  label,
  accent = false,
  onClick,
  haspopup = false,
}: {
  readonly icon: IconName;
  readonly label: TranslationKey;
  readonly accent?: boolean;
  readonly haspopup?: boolean;
  readonly onClick: (anchor: DOMRect) => void;
}) {
  return (
    <button
      type="button"
      className={styles.tool}
      aria-haspopup={haspopup ? 'menu' : undefined}
      onClick={(event) => {
        onClick(event.currentTarget.getBoundingClientRect());
      }}
    >
      <span className={cx(styles.toolIcon, accent && styles.toolIconAccent)}>
        <Icon name={icon} />
      </span>
      <span className={styles.toolLabel}>{t(label)}</span>
    </button>
  );
}

/**
 * Панель элементов слева (на телефоне — снизу), как в Milanote: нажатие кладёт элемент
 * в центр экрана.
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
  const place = (tool: PaletteTool): void => {
    tool.place(model, worldPoint(controls, null), pickers);
  };
  const button = (tool: PaletteTool) => (
    <PaletteButton
      key={tool.id}
      icon={tool.icon}
      label={tool.label}
      accent={tool.id === 'board'}
      onClick={() => {
        place(tool);
      }}
    />
  );
  return (
    <nav className={styles.palette} aria-label={t('board.palette.title')}>
      {CARD_TOOLS.map(button)}
      <PaletteButton icon="more" label="board.palette.more" haspopup onClick={onMore} />
      <span className={styles.separator} />
      {FILE_TOOLS.map(button)}
    </nav>
  );
}
