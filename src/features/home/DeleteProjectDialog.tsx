import { useState, type SyntheticEvent } from 'react';
import type { ProjectEntry } from '../../data';
import { t } from '../../i18n';
import { Button, Dialog, TextField } from '../../ui';
import { useWorkspace } from '../workspace';
import { removeProject } from './removeProject';
import styles from './Home.module.css';

type UsableProject = Extract<ProjectEntry, { status: 'ok' }>;

function useProjectRemoval(entry: UsableProject, onDeleted: () => void) {
  const workspace = useWorkspace();
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const confirmed = confirmation === entry.meta.name;
  const submit = (event: SyntheticEvent): void => {
    event.preventDefault();
    if (!confirmed || busy) return;
    setBusy(true);
    setError(null);
    removeProject(workspace, entry)
      .then(onDeleted)
      .catch((failure: unknown) => {
        console.error('Проект не удалён', failure);
        setError(t('home.deleteFailed', { error: String(failure) }));
        setBusy(false);
      });
  };
  return { confirmation, setConfirmation, busy, error, confirmed, submit };
}

/** Подтверждение относится к конкретному проекту; отмена не выполняет файловых операций. */
export function DeleteProjectDialog({
  entry,
  onClose,
  onDeleted,
}: {
  readonly entry: UsableProject;
  readonly onClose: () => void;
  readonly onDeleted: () => void;
}) {
  const state = useProjectRemoval(entry, onDeleted);
  return (
    <Dialog
      title={t('home.deleteProjectNamed', { name: entry.meta.name })}
      closeLabel={t('common.cancel')}
      onClose={() => {
        if (!state.busy) onClose();
      }}
    >
      <form className={styles.form} onSubmit={state.submit}>
        <p>{t('home.deleteDescription', { name: entry.meta.name })}</p>
        <p className={styles.folder}>{entry.folder}</p>
        <TextField
          label={t('home.deleteConfirmation', { name: entry.meta.name })}
          value={state.confirmation}
          disabled={state.busy}
          onChange={(event) => {
            state.setConfirmation(event.target.value);
          }}
        />
        {state.error !== null && (
          <p className={styles.error} role="alert">
            {state.error}
          </p>
        )}
        <Button type="submit" disabled={!state.confirmed || state.busy}>
          {t(state.busy ? 'home.deleting' : 'home.deleteProject')}
        </Button>
      </form>
    </Dialog>
  );
}
