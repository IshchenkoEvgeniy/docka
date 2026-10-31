import { optionsOf, type EntityType, type FieldWithId } from '../../core';
import { fieldName, kindName, optionName, typeName, useEntityTypes } from '../../elements';
import { t } from '../../i18n';
import { Button } from '../../ui';
import { LazyInput } from './LazyInput';
import type { ProjectEntities } from './projectEntities';
import styles from './Entities.module.css';

interface FieldItemProps {
  readonly entities: ProjectEntities;
  readonly type: EntityType;
  readonly field: FieldWithId;
  /** Соседи по порядку — для «выше» и «ниже» одной командой. */
  readonly previous: readonly FieldWithId[];
  readonly next: readonly FieldWithId[];
}

/** Порядок между соседями: поле переезжает одной правкой своего order. */
function orderBetween(a: FieldWithId | undefined, b: FieldWithId | undefined, fallback: number) {
  if (a === undefined && b === undefined) return fallback;
  if (a === undefined) return (b?.order ?? fallback) - 1;
  if (b === undefined) return a.order + 1;
  return (a.order + b.order) / 2;
}

function OptionsEditor({ entities, type, field }: Omit<FieldItemProps, 'previous' | 'next'>) {
  const base = { typeId: type.id, fieldId: field.id };
  return (
    <div className={styles.optionList}>
      {optionsOf(field).map((option) => (
        <div key={option.id} className={styles.inline}>
          <LazyInput
            value={option.name === '' ? optionName(option) : option.name}
            aria-label={t('entities.types.optionName')}
            maxLength={100}
            onCommit={(name) => {
              entities.run({
                kind: 'updateFieldOption',
                ...base,
                optionId: option.id,
                changes: { name },
              });
            }}
          />
          <Button
            variant="ghost"
            aria-label={t('entities.types.removeOption')}
            onClick={() => {
              entities.run({
                kind: 'updateFieldOption',
                ...base,
                optionId: option.id,
                changes: { removed: true },
              });
            }}
          >
            {t('entities.panel.unlinkIcon')}
          </Button>
        </div>
      ))}
      <LazyInput
        key={optionsOf(field).length}
        value=""
        placeholder={t('entities.types.addOption')}
        aria-label={t('entities.types.addOption')}
        maxLength={100}
        onCommit={(name) => {
          if (name.trim() !== '') entities.run({ kind: 'addFieldOption', ...base, name });
        }}
      />
    </div>
  );
}

function RelationSettings({ entities, type, field }: Omit<FieldItemProps, 'previous' | 'next'>) {
  const types = [...useEntityTypes().values()];
  const base = { kind: 'updateField' as const, typeId: type.id, fieldId: field.id };
  return (
    <div className={styles.inline}>
      <select
        className={styles.input}
        aria-label={t('entities.types.target')}
        value={field.target ?? ''}
        onChange={(event) => {
          const target = types.find((item) => item.id === event.target.value)?.id ?? null;
          entities.run({ ...base, changes: { target } });
        }}
      >
        <option value="">{t('entities.types.anyType')}</option>
        {types.map((item) => (
          <option key={item.id} value={item.id}>
            {typeName(item)}
          </option>
        ))}
      </select>
      <LazyInput
        value={field.backName ?? ''}
        placeholder={t('entities.types.backName')}
        aria-label={t('entities.types.backName')}
        maxLength={100}
        onCommit={(backName) => {
          entities.run({ ...base, changes: { backName: backName.trim() } });
        }}
      />
    </div>
  );
}

/** Поле типа: название, вид, «на карточке», порядок, скрытие; варианты и цель связи. */
export function FieldItem({ entities, type, field, previous, next }: FieldItemProps) {
  const base = { kind: 'updateField' as const, typeId: type.id, fieldId: field.id };
  const move = (order: number): void => {
    entities.run({ ...base, changes: { order } });
  };
  return (
    <li className={styles.typeField}>
      <div className={styles.inline}>
        <LazyInput
          value={field.name === '' ? fieldName(field) : field.name}
          aria-label={t('entities.types.fieldName')}
          maxLength={100}
          onCommit={(name) => {
            entities.run({ ...base, changes: { name: name.trim() } });
          }}
        />
        <span className={styles.muted}>
          {field.kind === 'relation' && field.multiple === true
            ? t('entities.types.manyLinks')
            : kindName(field.kind)}
        </span>
      </div>
      <div className={styles.inline}>
        <label className={styles.optionLabel}>
          <input
            type="checkbox"
            className={styles.check}
            checked={field.onCard}
            onChange={(event) => {
              entities.run({ ...base, changes: { onCard: event.target.checked } });
            }}
          />
          {t('entities.types.onCard')}
        </label>
        <Button
          variant="ghost"
          disabled={previous.length === 0}
          aria-label={t('entities.types.moveUp')}
          onClick={() => {
            move(orderBetween(previous.at(-2), previous.at(-1), field.order));
          }}
        >
          {t('entities.types.moveUpIcon')}
        </Button>
        <Button
          variant="ghost"
          disabled={next.length === 0}
          aria-label={t('entities.types.moveDown')}
          onClick={() => {
            move(orderBetween(next[0], next[1], field.order));
          }}
        >
          {t('entities.types.moveDownIcon')}
        </Button>
        <Button
          variant="ghost"
          onClick={() => {
            entities.run({ kind: 'removeField', typeId: type.id, fieldId: field.id });
          }}
        >
          {t('entities.types.hideField')}
        </Button>
      </div>
      {(field.kind === 'select' || field.kind === 'multiSelect') && (
        <OptionsEditor entities={entities} type={type} field={field} />
      )}
      {field.kind === 'relation' && (
        <RelationSettings entities={entities} type={type} field={field} />
      )}
    </li>
  );
}
