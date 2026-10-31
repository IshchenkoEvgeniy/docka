import { useMemo } from 'react';
import {
  backLinks,
  fieldValue,
  fieldsOf,
  selectedIds,
  type Entity,
  type EntityType,
  type FieldWithId,
} from '../../core';
import { t } from '../../i18n';
import { cx } from '../../ui';
import { useEntities, useEntityLinks, useEntityTypes } from '../entityLinks';
import { EntityChips, FieldImage, FieldValue } from './FieldValue';
import { backLinkName, entityName, fieldName, typeName } from '../entityLabels';
import styles from './Entity.module.css';

/** Сколько полей показывает вид «карточка» (ТЗ: 3–5 главных). */
const CARD_FIELDS = 5;

interface ViewProps {
  readonly entity: Entity;
  readonly type: EntityType;
}

/** Пусто ли поле (у длинного текста — пустой ли текст). */
export function useIsEmpty(): (entity: Entity, field: FieldWithId) => boolean {
  const links = useEntityLinks();
  return (entity, field) => {
    if (field.kind === 'longText')
      return (links?.directory.textOf(entity.id, field.id)?.length ?? 0) === 0;
    if (field.kind === 'relation' || field.kind === 'select' || field.kind === 'multiSelect')
      return selectedIds(field, entity.values).length === 0;
    return fieldValue(field, entity.values) === undefined;
  };
}

function Header({ entity, type }: ViewProps) {
  return (
    <div className={styles.header}>
      <span className={styles.icon} aria-hidden="true">
        {type.icon}
      </span>
      <span className={styles.name}>{entityName(entity.name)}</span>
      <span className={styles.type}>{typeName(type)}</span>
    </div>
  );
}

function FieldRows({
  entity,
  fields,
}: {
  readonly entity: Entity;
  readonly fields: readonly FieldWithId[];
}) {
  return (
    <dl className={styles.fields}>
      {fields.map((field) => (
        <div key={field.id} className={styles.row}>
          <dt className={styles.label}>{fieldName(field)}</dt>
          <dd className={styles.value}>
            <FieldValue entity={entity} field={field} />
          </dd>
        </div>
      ))}
    </dl>
  );
}

export function EntityChip({ entity, type }: ViewProps) {
  return (
    <div className={styles.chip}>
      <span className={styles.icon} aria-hidden="true">
        {type.icon}
      </span>
      <span className={styles.name}>{entityName(entity.name)}</span>
    </div>
  );
}

/** Картинка и несколько главных полей (отмеченных «на карточке»), только заполненные. */
export function EntityCard({ entity, type }: ViewProps) {
  const isEmpty = useIsEmpty();
  const fields = fieldsOf(type).filter((field) => field.onCard && !isEmpty(entity, field));
  const image = fields.find((field) => field.kind === 'image');
  const asset = image === undefined ? undefined : fieldValue(image, entity.values);
  const rest = fields.filter((field) => field !== image).slice(0, CARD_FIELDS);
  return (
    <div className={styles.card}>
      {typeof asset === 'string' && <FieldImage asset={asset} className={styles.cover} />}
      <Header entity={entity} type={type} />
      <FieldRows entity={entity} fields={rest} />
    </div>
  );
}

function BackLinks({ entity }: { readonly entity: Entity }) {
  const entities = useEntities();
  const types = useEntityTypes();
  const links = useMemo(
    () => backLinks(entity.id, entities.values(), types),
    [entity.id, entities, types],
  );
  if (links.length === 0) return null;
  return (
    <dl className={styles.fields}>
      {links.map((link) => (
        <div key={`${link.typeId}/${link.fieldId}`} className={styles.row}>
          <dt className={styles.label}>{backLinkName(link, types)}</dt>
          <dd className={styles.value}>
            <EntityChips ids={link.entityIds} />
          </dd>
        </div>
      ))}
    </dl>
  );
}

/** Все поля и обратные связи. */
export function EntityFull({ entity, type }: ViewProps) {
  return (
    <div className={cx(styles.card, styles.full)}>
      <Header entity={entity} type={type} />
      <FieldRows entity={entity} fields={fieldsOf(type)} />
      <BackLinks entity={entity} />
    </div>
  );
}

export function EntityMissing() {
  return <div className={styles.missing}>{t('entities.missing')}</div>;
}
