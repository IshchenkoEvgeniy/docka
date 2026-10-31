import { useState, type SyntheticEvent } from 'react';
import type { BoardId, CommandEnvironment } from '../../core';
import { saveTemplate, type OpenProject } from '../../data';
import { t } from '../../i18n';
import { Button, Dialog, TextField } from '../../ui';
import { captureTemplate } from './capture';
import styles from './Templates.module.css';

/** «Сохранить как шаблон»: доска с вложенными — в файл templates/<id>.json проекта. */
export function SaveTemplateDialog({
  project,
  environment,
  boardId,
  title,
  onClose,
}: {
  readonly project: OpenProject;
  readonly environment: CommandEnvironment;
  readonly boardId: BoardId;
  readonly title: string;
  readonly onClose: () => void;
}) {
  const [name, setName] = useState(title);
  const [description, setDescription] = useState('');
  const [state, setState] = useState<{ busy: boolean; message: string | null }>({
    busy: false,
    message: null,
  });
  const submit = (event: SyntheticEvent): void => {
    event.preventDefault();
    setState({ busy: true, message: null });
    const id = environment.ids.next();
    captureTemplate(project, boardId, { id, name: name.trim(), description: description.trim() })
      .then(async (template) => {
        const saved = template === null ? null : await saveTemplate(project.fs, template);
        if (saved?.ok === true) onClose();
        else
          setState({ busy: false, message: saved === null ? t('templates.noBoard') : saved.error });
      })
      .catch((failure: unknown) => {
        setState({ busy: false, message: String(failure) });
      });
  };
  return (
    <Dialog title={t('templates.save')} closeLabel={t('common.cancel')} onClose={onClose}>
      <form className={styles.form} onSubmit={submit}>
        <TextField
          label={t('templates.name')}
          value={name}
          autoFocus
          maxLength={200}
          error={state.message}
          onChange={(event) => {
            setName(event.target.value);
          }}
        />
        <TextField
          label={t('templates.description')}
          value={description}
          maxLength={1000}
          onChange={(event) => {
            setDescription(event.target.value);
          }}
        />
        <p className={styles.description}>{t('templates.saveHint')}</p>
        <Button type="submit" variant="primary" disabled={state.busy || name.trim() === ''}>
          {t('common.save')}
        </Button>
      </form>
    </Dialog>
  );
}
