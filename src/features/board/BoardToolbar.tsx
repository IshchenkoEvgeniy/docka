import { useState, useSyncExternalStore } from 'react';
import { useStore } from 'zustand';
import { useCamera, useInteraction, type CameraControls } from '../../canvas';
import { t } from '../../i18n';
import { Button, Icon, cx } from '../../ui';
import type { BoardModel } from './model';
import { fitAll, zoomTo } from './view';
import styles from './Toolbar.module.css';
import boardStyles from './Board.module.css';
import { BoardToolbarExtras, type ToolbarMenu } from './BoardToolbarExtras';
import { stopEditing } from './boardActions';

/** Меню панели: «Добавить» и «Действия» с выделенным (на телефоне правой кнопки нет). */
export type { ToolbarMenu } from './BoardToolbarExtras';

interface BoardToolbarProps {
  readonly model: BoardModel;
  readonly controls: CameraControls;
  readonly onHelp: () => void;
  readonly onOpenMenu: (menu: ToolbarMenu, anchor: DOMRect) => void;
}

/** Всё, что есть в горячих клавишах и меню, доступно и пальцем (CLAUDE.md, раздел UX). */
export function BoardToolbar({ model, controls, onHelp, onOpenMenu }: BoardToolbarProps) {
  const [expanded, setExpanded] = useState(false);
  const canUndo = useSyncExternalStore(model.undo.subscribe, model.undo.canUndo);
  const canRedo = useSyncExternalStore(model.undo.subscribe, model.undo.canRedo);
  const zoom = useCamera(controls).zoom;
  const editing = useInteraction(model.interaction, (state) => state.editingId !== null);
  const hasSelection = useInteraction(
    model.interaction,
    (state) => state.selection.size > 0 || state.connectionSelection.size > 0,
  );
  return (
    <div
      role="toolbar"
      aria-label={t('board.toolbar.title')}
      className={cx(styles.toolbar, expanded && styles.expanded, editing && styles.editing)}
    >
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
      <Button
        className={styles.fitButton}
        aria-label={t('board.toolbar.fitAll')}
        onClick={() => {
          fitAll(model, controls);
        }}
      >
        <span className={styles.fullLabel}>{t('board.toolbar.fitAll')}</span>
        <span className={styles.compactIcon}>
          <Icon name="fit" />
        </span>
      </Button>
      <Button
        className={styles.zoomButton}
        onClick={() => {
          zoomTo(controls, 1);
        }}
        title={t('hotkeys.zoom100')}
      >
        {`${String(Math.round(zoom * 100))} %`}
      </Button>
      {hasSelection && (
        <Button
          aria-label={t('board.toolbar.actions')}
          aria-haspopup="menu"
          onClick={(event) => {
            onOpenMenu('actions', event.currentTarget.getBoundingClientRect());
          }}
        >
          <span className={styles.fullLabel}>{t('board.toolbar.actions')}</span>
          <span className={styles.compactIcon}>
            <Icon name="more" />
          </span>
        </Button>
      )}
      <Button
        className={styles.toggle}
        aria-label={t('board.toolbar.controls')}
        title={t('board.toolbar.controls')}
        aria-expanded={expanded}
        pressed={expanded}
        onClick={() => {
          setExpanded(!expanded);
        }}
      >
        <Icon name="controls" />
      </Button>
      <BoardToolbarExtras
        model={model}
        controls={controls}
        onHelp={onHelp}
        onOpenMenu={onOpenMenu}
      />
    </div>
  );
}

/** Сообщение внизу экрана (ошибка команды, подсказка). */
export function BoardNotice({ model }: { readonly model: BoardModel }) {
  const message = useStore(model.notice, (state) => state.message);
  if (message === null) return null;
  return (
    <div className={boardStyles.notice} role="status">
      {message}
    </div>
  );
}
