import { useState, type SyntheticEvent } from 'react';
import { FIELD_KINDS, type EntityType, type FieldKind } from '../../core';
import { kindName, typeName, useEntityTypes } from '../../elements';
import { t } from '../../i18n';
import { Button } from '../../ui';
import type { ProjectEntities } from './projectEntities';
import styles from './Entities.module.css';

/** Новое поле типа: название и вид; у связи — тип целей и «одна или много». */
export function NewFieldForm({
  entities,
  type,
  onError,
}: {
  readonly entities: ProjectEntities;
  readonly type: EntityType;
  readonly onError: (message: string) => void;
}) {
  const types = [...useEntityTypes().values()];
  const [name, setName] = useState('');
  const [kind, setKind] = useState<FieldKind>('text');
  const [target, setTarget] = useState('');
  const [multiple, setMultiple] = useState(false);
  const submit = (event: SyntheticEvent): void => {
    event.preventDefault();
    const targetId = types.find((item) => item.id === target)?.id ?? null;
    const result = entities.run({
      kind: 'addField',
      typeId: type.id,
      field: { name, kind, ...(kind === 'relation' ? { target: targetId, multiple } : {}) },
    });
    if (!result.ok) onError(result.error);
    else setName('');
  };
  return (
    <form className={styles.newField} onSubmit={submit}>
      <input
        className={styles.input}
        value={name}
        maxLength={100}
        placeholder={t('entities.types.newField')}
        aria-label={t('entities.types.newField')}
        onChange={(event) => {
          setName(event.target.value);
        }}
      />
      <select
        className={styles.input}
        value={kind}
        aria-label={t('entities.types.kind')}
        onChange={(event) => {
          setKind(FIELD_KINDS.find((item) => item === event.target.value) ?? 'text');
        }}
      >
        {FIELD_KINDS.map((item) => (
          <option key={item} value={item}>
            {kindName(item)}
          </option>
        ))}
      </select>
      {kind === 'relation' && (
        <>
          <select
            className={styles.input}
            value={target}
            aria-label={t('entities.types.target')}
            onChange={(event) => {
              setTarget(event.target.value);
            }}
          >
            <option value="">{t('entities.types.anyType')}</option>
            {types.map((item) => (
              <option key={item.id} value={item.id}>
                {typeName(item)}
              </option>
            ))}
          </select>
          <label className={styles.optionLabel}>
            <input
              type="checkbox"
              className={styles.check}
              checked={multiple}
              onChange={(event) => {
                setMultiple(event.target.checked);
              }}
            />
            {t('entities.types.multiple')}
          </label>
        </>
      )}
      <Button type="submit" variant="primary" disabled={name.trim() === ''}>
        {t('entities.types.addField')}
      </Button>
    </form>
  );
}
