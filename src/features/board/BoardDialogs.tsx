import { useState, type SyntheticEvent } from 'react';
import type { Point } from '../../canvas';
import { useStore } from 'zustand';
import { BOARD_BACKGROUNDS, COLOR_NAMES, type BoardBackground, type ColorName } from '../../core';
import { t } from '../../i18n';
import { Button, ColorPalette, Dialog, Segmented, TextField, cardColor, inkColor } from '../../ui';
import { createFromText, selectedElements, updateConnection } from './boardActions';
import type { BoardModel } from './model';
import { placeElements, placeWithCopies } from './references';
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

/** Вставка карточек сущностей: ссылки на те же сущности или независимые копии (ТЗ, раздел 6). */
function ReferencesChoice({
  model,
  elements,
  onClose,
}: {
  readonly model: BoardModel;
  readonly elements: Parameters<typeof placeElements>[1];
  readonly onClose: () => void;
}) {
  return (
    <div className={styles.form}>
      <p className={styles.hint}>{t('board.dialog.referencesHint')}</p>
      <Button
        variant="primary"
        autoFocus
        onClick={() => {
          onClose();
          placeElements(model, elements, false);
        }}
      >
        {t('board.dialog.asLinks')}
      </Button>
      <Button
        onClick={() => {
          onClose();
          placeWithCopies(model, elements);
        }}
      >
        {t('board.dialog.asCopies')}
      </Button>
    </div>
  );
}

/** Адрес новой ссылки: карточка встаёт в центр экрана, превью подтягивается из сети. */
function LinkForm({
  model,
  at,
  onClose,
}: {
  readonly model: BoardModel;
  readonly at: Point;
  readonly onClose: () => void;
}) {
  const [url, setUrl] = useState('');
  const [error, setError] = useState<string | null>(null);
  const submit = (event: SyntheticEvent): void => {
    event.preventDefault();
    if (!createFromText(model, url.trim(), at)) {
      setError(t('board.dialog.notLink'));
      return;
    }
    onClose();
  };
  return (
    <form className={styles.form} onSubmit={submit}>
      <TextField
        label={t('board.dialog.linkField')}
        value={url}
        autoFocus
        inputMode="url"
        placeholder={t('board.dialog.linkPlaceholder')}
        error={error}
        maxLength={2000}
        onChange={(event) => {
          setUrl(event.target.value);
          setError(null);
        }}
      />
      <Button type="submit" variant="primary" disabled={url.trim() === ''}>
        {t('board.dialog.addLink')}
      </Button>
    </form>
  );
}

/** Окна доски: цвет элементов и стрелок, подпись стрелки, фон доски, вставка сущностей. */
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
  if (dialog.kind === 'link')
    return (
      <Dialog title={t('board.dialog.link')} closeLabel={t('common.cancel')} onClose={close}>
        <LinkForm model={model} at={dialog.at} onClose={close} />
      </Dialog>
    );
  if (dialog.kind === 'references')
    return (
      <Dialog title={t('board.dialog.references')} closeLabel={t('common.cancel')} onClose={close}>
        <ReferencesChoice model={model} elements={dialog.elements} onClose={close} />
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
