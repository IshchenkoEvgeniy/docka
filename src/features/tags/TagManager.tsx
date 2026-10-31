import { useState } from 'react';
import { COLOR_NAMES, type ColorName, type Tag } from '../../core';
import { useTags } from '../../elements';
import { t } from '../../i18n';
import { Button, Dialog, cardColor } from '../../ui';
import type { ProjectTags } from './projectTags';
import { realTags } from './tree';
import styles from './Tags.module.css';

function TagName({
  tag,
  onRename,
}: {
  readonly tag: Tag;
  readonly onRename: (name: string) => void;
}) {
  const [text, setText] = useState(tag.name);
  return (
    <input
      className={styles.input}
      value={text}
      maxLength={100}
      aria-label={t('tags.name')}
      onChange={(event) => {
        setText(event.target.value);
      }}
      onBlur={() => {
        if (text.trim() !== tag.name) onRename(text);
      }}
      onKeyDown={(event) => {
        if (event.key === 'Enter') event.currentTarget.blur();
      }}
    />
  );
}

function TagEditor({
  tag,
  others,
  run,
}: {
  readonly tag: Tag;
  readonly others: readonly Tag[];
  readonly run: ProjectTags['run'];
}) {
  return (
    <li className={styles.managerRow}>
      <span className={styles.dot} style={{ background: cardColor(tag.color) }} />
      <TagName
        key={tag.name}
        tag={tag}
        onRename={(name) => run({ kind: 'updateTag', tagId: tag.id, changes: { name } })}
      />
      <select
        className={styles.select}
        aria-label={t('tags.color')}
        value={tag.color}
        onChange={(event) => {
          const color: ColorName =
            COLOR_NAMES.find((item) => item === event.target.value) ?? 'default';
          run({ kind: 'updateTag', tagId: tag.id, changes: { color } });
        }}
      >
        {COLOR_NAMES.map((color) => (
          <option key={color} value={color}>
            {t(`colors.${color}`)}
          </option>
        ))}
      </select>
      <select
        className={styles.select}
        aria-label={t('tags.mergeInto')}
        value=""
        onChange={(event) => {
          const into = others.find((other) => other.id === event.target.value);
          if (into !== undefined) run({ kind: 'mergeTags', tagId: tag.id, intoId: into.id });
        }}
      >
        <option value="">{t('tags.mergeInto')}</option>
        {others.map((other) => (
          <option key={other.id} value={other.id}>
            {other.name}
          </option>
        ))}
      </select>
      <Button
        variant="ghost"
        className={styles.danger}
        aria-label={t('tags.delete', { name: tag.name })}
        onClick={() => run({ kind: 'deleteTag', tagId: tag.id })}
      >
        {t('tags.deleteIcon')}
      </Button>
    </li>
  );
}

/** Управление тегами проекта: переименование, цвет, слияние, удаление — сразу везде (ADR 0006). */
export function TagManager({
  tags,
  onClose,
}: {
  readonly tags: ProjectTags;
  readonly onClose: () => void;
}) {
  const rows = realTags(useTags());
  const [error, setError] = useState<string | null>(null);
  const run: ProjectTags['run'] = (command) => {
    const result = tags.run(command);
    setError(result.ok ? null : result.error);
    return result;
  };
  return (
    <Dialog title={t('tags.manage')} closeLabel={t('common.close')} onClose={onClose}>
      <div className={styles.picker}>
        <p className={styles.muted}>{t('tags.manageHint')}</p>
        {error !== null && <p className={styles.error}>{error}</p>}
        {rows.length === 0 && <p className={styles.muted}>{t('tags.empty')}</p>}
        <ul className={styles.list}>
          {rows.map((tag) => (
            <TagEditor
              key={tag.id}
              tag={tag}
              others={rows.filter((other) => other.id !== tag.id)}
              run={run}
            />
          ))}
        </ul>
      </div>
    </Dialog>
  );
}
