import { useEffect, useState } from 'react';
import type { BoardId, CommandEnvironment, Template } from '../../core';
import { executeProjectCommand, listTemplates, type OpenProject } from '../../data';
import { t } from '../../i18n';
import { Button, Dialog } from '../../ui';
import { applyTemplate } from './apply';
import { builtinTemplates } from './builtin';
import styles from './Templates.module.css';

/** Свои шаблоны проекта (файлы templates/); перечитываются при открытии окна. */
function useSavedTemplates(project: OpenProject): [readonly Template[], () => void] {
  const [saved, setSaved] = useState<readonly Template[]>([]);
  const [version, setVersion] = useState(0);
  useEffect(() => {
    let cancelled = false;
    listTemplates(project.fs, project.projectDoc.doc).then(
      (list) => {
        if (list.invalid.length > 0) console.error('Шаблоны пропущены', list.invalid);
        if (!cancelled) setSaved(list.templates);
      },
      (error: unknown) => {
        console.error('Шаблоны не прочитаны', error);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [project, version]);
  return [
    saved,
    () => {
      setVersion((value) => value + 1);
    },
  ];
}

function TemplateRow({
  template,
  busy,
  onUse,
  onRemove,
}: {
  readonly template: Template;
  readonly busy: boolean;
  readonly onUse: () => void;
  readonly onRemove?: () => void;
}) {
  return (
    <li className={styles.row}>
      <button type="button" className={styles.use} disabled={busy} onClick={onUse}>
        <span className={styles.name}>{template.name}</span>
        <span className={styles.description}>{template.description}</span>
      </button>
      {onRemove !== undefined && (
        <Button
          variant="ghost"
          aria-label={t('templates.remove', { name: template.name })}
          onClick={onRemove}
        >
          {t('templates.removeIcon')}
        </Button>
      )}
    </li>
  );
}

/** Новая доска внутри текущей из шаблона: встроенные и свои шаблоны проекта (ТЗ, раздел 7). */
export function TemplatePicker({
  project,
  environment,
  parentId,
  onApplied,
  onClose,
}: {
  readonly project: OpenProject;
  readonly environment: CommandEnvironment;
  readonly parentId: BoardId;
  readonly onApplied: (boardId: BoardId) => void;
  readonly onClose: () => void;
}) {
  const [saved, reload] = useSavedTemplates(project);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const use = (template: Template) => () => {
    setBusy(true);
    applyTemplate(project, environment, template, { parentId }).then(
      (result) => {
        if (result.ok) onApplied(result.value);
        else setError(result.error);
        setBusy(false);
      },
      (failure: unknown) => {
        setError(String(failure));
        setBusy(false);
      },
    );
  };
  const remove = (template: Template) => () => {
    executeProjectCommand(
      project.projectDoc.doc,
      { kind: 'removeTemplate', templateId: template.id },
      environment,
    );
    reload();
  };
  return (
    <Dialog title={t('templates.pick')} closeLabel={t('common.close')} onClose={onClose}>
      {error !== null && <p className={styles.error}>{error}</p>}
      {saved.length > 0 && <h3 className={styles.heading}>{t('templates.saved')}</h3>}
      <ul className={styles.list}>
        {saved.map((template) => (
          <TemplateRow
            key={template.id}
            template={template}
            busy={busy}
            onUse={use(template)}
            onRemove={remove(template)}
          />
        ))}
      </ul>
      <h3 className={styles.heading}>{t('templates.builtin')}</h3>
      <ul className={styles.list}>
        {builtinTemplates().boards.map((template) => (
          <TemplateRow key={template.id} template={template} busy={busy} onUse={use(template)} />
        ))}
      </ul>
    </Dialog>
  );
}
