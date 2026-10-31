import { useState, type SyntheticEvent } from 'react';
import { t } from '../../i18n';
import { Button, Dialog, TextField } from '../../ui';
import styles from './Project.module.css';

interface RenameBoardDialogProps {
  readonly title: string;
  readonly onSave: (title: string) => string | null;
  readonly onClose: () => void;
}

/** Название доски; onSave возвращает текст ошибки или null. */
export function RenameBoardDialog({ title, onSave, onClose }: RenameBoardDialogProps) {
  const [value, setValue] = useState(title);
  const [error, setError] = useState<string | null>(null);
  const submit = (event: SyntheticEvent): void => {
    event.preventDefault();
    const failure = onSave(value.trim());
    if (failure === null) onClose();
    else setError(failure);
  };
  return (
    <Dialog title={t('project.rename')} closeLabel={t('common.cancel')} onClose={onClose}>
      <form className={styles.form} onSubmit={submit}>
        <TextField
          label={t('project.boardTitle')}
          value={value}
          error={error}
          autoFocus
          maxLength={200}
          onFocus={(event) => {
            event.target.select();
          }}
          onChange={(event) => {
            setValue(event.target.value);
            setError(null);
          }}
        />
        <Button type="submit" variant="primary" disabled={value.trim() === ''}>
          {t('common.save')}
        </Button>
      </form>
    </Dialog>
  );
}
