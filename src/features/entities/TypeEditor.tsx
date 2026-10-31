import { useState } from 'react';
import { COLOR_NAMES, fieldsOf, type ColorName, type EntityType } from '../../core';
import { fieldName, typeName, useEntityTypes } from '../../elements';
import { t } from '../../i18n';
import { Button, ColorPalette, Dialog, cardColor } from '../../ui';
import { FieldItem } from './FieldItem';
import { LazyInput } from './LazyInput';
import { NewFieldForm } from './NewFieldForm';
import type { ProjectEntities } from './projectEntities';
import styles from './Entities.module.css';

const palette = COLOR_NAMES.map((value) => ({
  value,
  label: t(`colors.${value}`),
  swatch: cardColor(value),
}));

function HiddenFields({
  entities,
  type,
}: {
  readonly entities: ProjectEntities;
  readonly type: EntityType;
}) {
  const hidden = fieldsOf(type, true).filter((field) => field.deletedAt !== null);
  if (hidden.length === 0) return null;
  return (
    <div className={styles.section}>
      <h3 className={styles.sectionTitle}>{t('entities.types.hidden')}</h3>
      <p className={styles.muted}>{t('entities.types.hiddenHint')}</p>
      {hidden.map((field) => (
        <div key={field.id} className={styles.inline}>
          <span>{fieldName(field)}</span>
          <Button
            variant="ghost"
            onClick={() => {
              entities.run({ kind: 'restoreField', typeId: type.id, fieldId: field.id });
            }}
          >
            {t('entities.types.restoreField')}
          </Button>
        </div>
      ))}
    </div>
  );
}

function TypeForm({
  entities,
  type,
  onError,
}: {
  readonly entities: ProjectEntities;
  readonly type: EntityType;
  readonly onError: (message: string) => void;
}) {
  const fields = fieldsOf(type);
  const run = (changes: { name?: string; icon?: string; color?: ColorName }): void => {
    const result = entities.run({ kind: 'updateEntityType', typeId: type.id, changes });
    if (!result.ok) onError(result.error);
  };
  return (
    <div className={styles.typeForm}>
      <div className={styles.inline}>
        <LazyInput
          key={`icon-${type.icon}`}
          className={styles.iconInput}
          value={type.icon}
          maxLength={4}
          aria-label={t('entities.types.icon')}
          onCommit={(icon) => {
            run({ icon });
          }}
        />
        <LazyInput
          key={`name-${type.name}`}
          value={type.name === '' ? typeName(type) : type.name}
          maxLength={100}
          aria-label={t('entities.types.name')}
          onCommit={(name) => {
            run({ name });
          }}
        />
      </div>
      <ColorPalette<ColorName>
        colors={palette}
        value={type.color}
        onPick={(color) => {
          run({ color });
        }}
      />
      <ol className={styles.typeFields}>
        {fields.map((field, index) => (
          <FieldItem
            key={`${field.id}-${String(field.order)}`}
            entities={entities}
            type={type}
            field={field}
            previous={fields.slice(0, index)}
            next={fields.slice(index + 1)}
          />
        ))}
      </ol>
      <NewFieldForm entities={entities} type={type} onError={onError} />
      <HiddenFields entities={entities} type={type} />
      <Button
        className={styles.danger}
        variant="ghost"
        onClick={() => {
          const result = entities.run({ kind: 'deleteEntityType', typeId: type.id });
          if (!result.ok) onError(result.error);
        }}
      >
        {t('entities.types.deleteType')}
      </Button>
    </div>
  );
}

/** Типы сущностей проекта: свои поля у каждого (ТЗ, раздел 6). */
export function TypeEditor({
  entities,
  onClose,
}: {
  readonly entities: ProjectEntities;
  readonly onClose: () => void;
}) {
  const types = [...useEntityTypes().values()].sort((a, b) =>
    typeName(a).localeCompare(typeName(b)),
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const selected = types.find((type) => type.id === selectedId) ?? types[0];
  const create = (): void => {
    const result = entities.run({
      kind: 'createEntityType',
      name: t('entities.types.newTypeName'),
      icon: '⭐',
      color: 'default',
    });
    if (result.ok && result.value.createdId !== undefined) setSelectedId(result.value.createdId);
  };
  return (
    <Dialog title={t('entities.types.title')} closeLabel={t('common.close')} onClose={onClose}>
      <div className={styles.typeEditor}>
        <nav className={styles.typeList} aria-label={t('entities.types.list')}>
          {types.map((type) => (
            <Button
              key={type.id}
              variant="ghost"
              pressed={type.id === selected?.id}
              onClick={() => {
                setSelectedId(type.id);
                setError(null);
              }}
            >
              {`${type.icon} ${typeName(type)}`}
            </Button>
          ))}
          <Button onClick={create}>{t('entities.types.newType')}</Button>
        </nav>
        {error !== null && <p className={styles.error}>{error}</p>}
        {selected !== undefined && (
          <TypeForm key={selected.id} entities={entities} type={selected} onError={setError} />
        )}
      </div>
    </Dialog>
  );
}
