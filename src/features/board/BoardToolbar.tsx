import { useSyncExternalStore } from 'react';
import { useStore } from 'zustand';
import { useCamera, useInteraction, type CameraControls } from '../../canvas';
import { t } from '../../i18n';
import { Button } from '../../ui';
import type { BoardModel } from './model';
import { fitAll, zoomBy, zoomTo } from './view';
import styles from './Board.module.css';
import { BoardExport } from './BoardExport';
import { FrameNavigator } from './FrameNavigator';
import { pasteFromApp } from './pasting';
import { stopEditing } from './boardActions';
import { worldPoint } from './view';

/** Меню панели: «Добавить» и «Действия» с выделенным (на телефоне правой кнопки нет). */
export type ToolbarMenu = 'add' | 'actions' | 'tags';

interface BoardToolbarProps {
  readonly model: BoardModel;
  readonly controls: CameraControls;
  readonly onHelp: () => void;
  readonly onOpenMenu: (menu: ToolbarMenu, anchor: DOMRect) => void;
}

/** Всё, что есть в горячих клавишах и меню, доступно и пальцем (CLAUDE.md, раздел UX). */
export function BoardToolbar({ model, controls, onHelp, onOpenMenu }: BoardToolbarProps) {
  const canUndo = useSyncExternalStore(model.undo.subscribe, model.undo.canUndo);
  const canRedo = useSyncExternalStore(model.undo.subscribe, model.undo.canRedo);
  const gridSnap = useStore(model.settings, (state) => state.gridSnap);
  const tagFilter = useStore(model.settings, (state) => state.tagFilter);
  const zoom = useCamera(controls).zoom;
  const editing = useInteraction(model.interaction, (state) => state.editingId !== null);
  const hasSelection = useInteraction(
    model.interaction,
    (state) => state.selection.size > 0 || state.connectionSelection.size > 0,
  );
  return (
    <div className={styles.toolbar}>
      {editing && (
        <Button
          onClick={() => {
            stopEditing(model);
          }}
        >
          {t('elements.text.done')}
        </Button>
      )}
      <Button
        disabled={!canUndo}
        onClick={() => void model.undo.undo()}
        title={t('hotkeys.undo')}
        aria-label={t('hotkeys.undo')}
      >
        {t('board.toolbar.undo')}
      </Button>
      <Button
        disabled={!canRedo}
        onClick={() => void model.undo.redo()}
        title={t('hotkeys.redo')}
        aria-label={t('hotkeys.redo')}
      >
        {t('board.toolbar.redo')}
      </Button>
      <span className={styles.divider} />
      <Button
        onClick={() => {
          void pasteFromApp(model, worldPoint(controls, null));
        }}
      >
        {t('board.menu.paste')}
      </Button>
      <Button
        onClick={() => {
          fitAll(model, controls);
        }}
      >
        {t('board.toolbar.fitAll')}
      </Button>
      <FrameNavigator model={model} controls={controls} />
      <Button
        className={styles.desktopOnly}
        onClick={() => {
          zoomBy(controls, -1);
        }}
        title={t('hotkeys.zoomOut')}
      >
        {t('board.toolbar.zoomOut')}
      </Button>
      <Button
        onClick={() => {
          zoomTo(controls, 1);
        }}
        title={t('hotkeys.zoom100')}
      >
        {`${String(Math.round(zoom * 100))} %`}
      </Button>
      <Button
        className={styles.desktopOnly}
        onClick={() => {
          zoomBy(controls, 1);
        }}
        title={t('hotkeys.zoomIn')}
      >
        {t('board.toolbar.zoomIn')}
      </Button>
      <span className={styles.divider} />
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
      {hasSelection && (
        <Button
          aria-haspopup="menu"
          onClick={(event) => {
            onOpenMenu('actions', event.currentTarget.getBoundingClientRect());
          }}
        >
          {t('board.toolbar.actions')}
        </Button>
      )}
      <Button
        variant="ghost"
        className={styles.desktopOnly}
        onClick={onHelp}
        title={t('hotkeys.help')}
      >
        {t('board.toolbar.help')}
      </Button>
      <BoardExport model={model} controls={controls} />
    </div>
  );
}

/** Сообщение внизу экрана (ошибка команды, подсказка). */
export function BoardNotice({ model }: { readonly model: BoardModel }) {
  const message = useStore(model.notice, (state) => state.message);
  if (message === null) return null;
  return (
    <div className={styles.notice} role="status">
      {message}
    </div>
  );
}
