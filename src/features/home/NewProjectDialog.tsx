import { useState, type SyntheticEvent } from 'react';
import { t } from '../../i18n';
import { Button, Dialog, TextField } from '../../ui';
import { useWorkspace } from '../workspace';
import { createProjectAt } from './placement';
import styles from './Home.module.css';

/** Где будет проект: папка проектов или выбранная папка (на компьютере). */
function LocationPicker({
  parent,
  onChange,
}: {
  readonly parent: string | null;
  readonly onChange: (parent: string | null) => void;
}) {
  const { services } = useWorkspace();
  const pick = services.openFolder === null ? null : services.pickFolder;
  return (
    <div className={styles.location}>
      <span className={styles.locationLabel}>{t('home.location')}</span>
      <span className={styles.locationPath}>{parent ?? services.projectsFolderLabel}</span>
      <div className={styles.locationActions}>
        {pick !== null && (
          <Button
            onClick={() => {
              void pick(t('home.pickLocation')).then((folder) => {
                if (folder !== null) onChange(folder);
              });
            }}
          >
            {t('home.pickLocation')}
          </Button>
        )}
        {parent !== null && (
          <Button
            variant="ghost"
            onClick={() => {
              onChange(null);
            }}
          >
            {t('home.defaultLocation')}
          </Button>
        )}
      </div>
    </div>
  );
}

/** Новый пустой проект: название и папка → папка «Название.doska» → сразу открывается. */
export function NewProjectDialog({ onClose }: { readonly onClose: () => void }) {
  const workspace = useWorkspace();
  const [name, setName] = useState('');
  const [parent, setParent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = (event: SyntheticEvent): void => {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    createProjectAt(workspace, parent, name)
      .then((placed) => {
        if (placed.ok) {
          workspace.openProject(placed.key);
          return;
        }
        setError(placed.error);
        setBusy(false);
      })
      .catch((failure: unknown) => {
        setError(String(failure));
        setBusy(false);
      });
  };

  return (
    <Dialog title={t('home.newProject')} closeLabel={t('common.cancel')} onClose={onClose}>
      <form className={styles.form} onSubmit={submit}>
        <TextField
          label={t('home.projectName')}
          value={name}
          error={error}
          autoFocus
          maxLength={100}
          onChange={(event) => {
            setName(event.target.value);
            setError(null);
          }}
        />
        <LocationPicker
          parent={parent}
          onChange={(next) => {
            setParent(next);
            setError(null);
          }}
        />
        <Button type="submit" variant="primary" disabled={busy || name.trim() === ''}>
          {t('home.create')}
        </Button>
      </form>
    </Dialog>
  );
}
