import { useState, type SyntheticEvent } from 'react';
import type { TagSet } from '../../core';
import { useTags } from '../../elements';
import { t } from '../../i18n';
import { Button, Dialog, cardColor } from '../../ui';
import type { ProjectTags } from './projectTags';
import { tagRows, tagState } from './tree';
import styles from './Tags.module.css';

export interface TagPickerProps {
  readonly title: string;
  readonly tags: ProjectTags;
  /** Множества тегов выбранных записей (один или несколько элементов, доска, сущность). */
  readonly sets: readonly Readonly<TagSet>[];
  /** Отметить или снять тег у всех записей — одной командой. */
  readonly onToggle: (tagId: string, on: boolean) => void;
  readonly onClose: () => void;
}

/** Теги записи: галочки по дереву тегов и новый тег («баг/критичный» — вложенный). */
export function TagPicker({ title, tags, sets, onToggle, onClose }: TagPickerProps) {
  const rows = tagRows(useTags());
  const [name, setName] = useState('');
  const add = (event: SyntheticEvent): void => {
    event.preventDefault();
    const id = tags.ensure(name);
    if (id === null) return;
    onToggle(id, true);
    setName('');
  };
  return (
    <Dialog title={title} closeLabel={t('common.close')} onClose={onClose}>
      <div className={styles.picker}>
        {rows.length === 0 && <p className={styles.muted}>{t('tags.empty')}</p>}
        <ul className={styles.list}>
          {rows.map(({ name, tag, depth, leaf }) => {
            const indent = { paddingLeft: `calc(${String(depth)} * var(--space-4))` };
            if (tag === null)
              return (
                <li key={name} className={styles.parent} style={indent}>
                  {leaf}
                </li>
              );
            const state = tagState(sets, tag.id);
            return (
              <li key={tag.id} style={indent}>
                <label className={styles.row}>
                  <input
                    type="checkbox"
                    className={styles.check}
                    checked={state === 'on'}
                    ref={(node) => {
                      if (node !== null) node.indeterminate = state === 'mixed';
                    }}
                    onChange={(event) => {
                      onToggle(tag.id, event.target.checked);
                    }}
                  />
                  <span className={styles.dot} style={{ background: cardColor(tag.color) }} />
                  {leaf}
                </label>
              </li>
            );
          })}
        </ul>
        <form className={styles.add} onSubmit={add}>
          <input
            className={styles.input}
            value={name}
            maxLength={100}
            placeholder={t('tags.newPlaceholder')}
            aria-label={t('tags.new')}
            onChange={(event) => {
              setName(event.target.value);
            }}
          />
          <Button type="submit" disabled={name.trim() === ''}>
            {t('tags.add')}
          </Button>
        </form>
      </div>
    </Dialog>
  );
}
