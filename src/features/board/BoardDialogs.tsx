import { useState, type SyntheticEvent } from 'react';
import { useStore } from 'zustand';
import { BOARD_BACKGROUNDS, COLOR_NAMES, type BoardBackground, type ColorName } from '../../core';
import { t } from '../../i18n';
import { Button, ColorPalette, Dialog, Segmented, TextField, cardColor, inkColor } from '../../ui';
import { selectedElements, updateConnection } from './boardActions';
import type { BoardModel } from './model';
import styles from './Board.module.css';

function palette(swatch: (color: ColorName) => string) {
  return COLOR_NAMES.map((value) => ({
    value,
    label: t(`colors.${value}`),
    swatch: swatch(value),
  }));
}

function LabelForm({
  model,
  connectionId,
  onClose,
}: {
  readonly model: BoardModel;
  readonly connectionId: string;
  readonly onClose: () => void;
}) {
  const [label, setLabel] = useState(
    () => model.connections.getSnapshot().get(connectionId)?.label ?? '',
  );
  const submit = (event: SyntheticEvent): void => {
    event.preventDefault();
    updateConnection(model, connectionId, { label: label.trim() });
    onClose();
  };
  return (
    <form className={styles.form} onSubmit={submit}>
      <TextField
        label={t('board.dialog.labelField')}
        value={label}
        autoFocus
        maxLength={500}
        onChange={(event) => {
          setLabel(event.target.value);
        }}
      />
      <Button type="submit" variant="primary">
        {t('common.save')}
      </Button>
    </form>
  );
}

/** Окна доски: цвет элементов и стрелок, подпись стрелки, фон доски. */
export function BoardDialogs({
  model,
  background,
}: {
  readonly model: BoardModel;
  readonly background: BoardBackground;
}) {
  const dialog = useStore(model.overlay, (state) => state.dialog);
  if (dialog === null) return null;
  const close = (): void => {
    model.overlay.setState({ dialog: null });
  };
  if (dialog.kind === 'label')
    return (
      <Dialog title={t('board.dialog.label')} closeLabel={t('common.cancel')} onClose={close}>
        <LabelForm model={model} connectionId={dialog.connectionId} onClose={close} />
      </Dialog>
    );
  if (dialog.kind === 'background')
    return (
      <Dialog title={t('board.dialog.background')} closeLabel={t('common.close')} onClose={close}>
        <Segmented<BoardBackground>
          label={t('board.dialog.background')}
          value={background}
          options={BOARD_BACKGROUNDS.map((value) => ({
            value,
            label: t(`board.background.${value}`),
          }))}
          onChange={(value) => {
            model.host.setBackground(value);
          }}
        />
      </Dialog>
    );
  const forConnection = dialog.kind === 'connectionColor';
  const current = forConnection
    ? (model.connections.getSnapshot().get(dialog.connectionId)?.color ?? null)
    : (selectedElements(model)[0]?.color ?? null);
  return (
    <Dialog title={t('board.dialog.color')} closeLabel={t('common.close')} onClose={close}>
      <ColorPalette<ColorName>
        colors={palette(forConnection ? inkColor : cardColor)}
        value={current}
        onPick={(color) => {
          if (forConnection) updateConnection(model, dialog.connectionId, { color });
          else
            model.run({
              kind: 'updateElements',
              elementIds: selectedElements(model).map((element) => element.id),
              changes: { color },
            });
          close();
        }}
      />
    </Dialog>
  );
}
