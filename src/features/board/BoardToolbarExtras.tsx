import { useStore } from 'zustand';
import type { CameraControls } from '../../canvas';
import { t } from '../../i18n';
import { Button } from '../../ui';
import { BoardExport } from './BoardExport';
import { FrameNavigator } from './FrameNavigator';
import type { BoardModel } from './model';
import { pasteFromApp } from './pasting';
import { worldPoint, zoomBy } from './view';
import styles from './Toolbar.module.css';

export type ToolbarMenu = 'add' | 'actions' | 'tags';

interface Props {
  readonly model: BoardModel;
  readonly controls: CameraControls;
  readonly onHelp: () => void;
  readonly onOpenMenu: (menu: ToolbarMenu, anchor: DOMRect) => void;
}

export function BoardToolbarExtras({ model, controls, onHelp, onOpenMenu }: Props) {
  const gridSnap = useStore(model.settings, (state) => state.gridSnap);
  const tagFilter = useStore(model.settings, (state) => state.tagFilter);
  return (
    <div className={styles.extras}>
      <Button
        onClick={() => {
          void pasteFromApp(model, worldPoint(controls, null));
        }}
      >
        {t('board.menu.paste')}
      </Button>
      <FrameNavigator model={model} controls={controls} />
      <Button
        onClick={() => {
          zoomBy(controls, -1);
        }}
        aria-label={t('hotkeys.zoomOut')}
      >
        {t('board.toolbar.zoomOut')}
      </Button>
      <Button
        onClick={() => {
          zoomBy(controls, 1);
        }}
        aria-label={t('hotkeys.zoomIn')}
      >
        {t('board.toolbar.zoomIn')}
      </Button>
      <Button
        pressed={gridSnap}
        onClick={() => {
          model.settings.setState({ gridSnap: !gridSnap });
        }}
      >
        {t('board.toolbar.grid')}
      </Button>
      <Button
        aria-haspopup="menu"
        pressed={tagFilter !== null}
        onClick={(event) => {
          onOpenMenu('tags', event.currentTarget.getBoundingClientRect());
        }}
      >
        {t('board.toolbar.tags')}
      </Button>
      <Button variant="ghost" onClick={onHelp}>
        {t('board.toolbar.help')}
      </Button>
      <BoardExport model={model} controls={controls} />
    </div>
  );
}
