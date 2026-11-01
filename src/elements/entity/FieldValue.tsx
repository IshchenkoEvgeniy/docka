import { useMemo } from 'react';
import { CONTROL_ATTRIBUTE } from '../../canvas';
import { fieldValue, optionsOf, selectedIds, type Entity, type FieldWithId } from '../../core';
import { fragmentToRich } from '../../data';
import { formatDate, formatNumber, t } from '../../i18n';
import { cardColor } from '../../ui';
import { useAssetIn } from '../image';
import { RichTextView } from '../text';
import { useEntities, useEntityLinks } from '../entityLinks';
import { entityName, optionName } from '../entityLabels';
import styles from './Entity.module.css';

const control = { [CONTROL_ATTRIBUTE]: '' };
/** Картинка поля — оформление карточки: подпись уже есть рядом (название сущности). */
const DECORATIVE = '';

/** Картинка поля «изображение» (файл из assets/ проекта). */
export function FieldImage({
  asset,
  className,
}: {
  readonly asset: string;
  readonly className?: string | undefined;
}) {
  const links = useEntityLinks();
  const state = useAssetIn(links?.assets ?? null, asset);
  if (state.status !== 'ready')
    return (
      <div
        className={className ?? styles.imageEmpty}
        data-asset-loading={state.status === 'loading' ? '' : undefined}
      />
    );
  return (
    <img className={className ?? styles.image} src={state.url} alt={DECORATIVE} draggable={false} />
  );
}

/** Связанные сущности чипами: щелчок открывает сущность. */
export function EntityChips({ ids }: { readonly ids: readonly string[] }) {
  const entities = useEntities();
  const links = useEntityLinks();
  return (
    <span className={styles.chips}>
      {ids.map((id) => {
        const target = entities.get(id);
        return (
          <button
            {...control}
            key={id}
            type="button"
            className={target === undefined ? styles.chipMissing : styles.linkChip}
            onClick={(event) => {
              // Чип внутри плитки или строки библиотеки: открыть связанную, а не саму сущность.
              event.stopPropagation();
              links?.openEntity(id);
            }}
          >
            {target === undefined ? t('entities.missing') : entityName(target.name)}
          </button>
        );
      })}
    </span>
  );
}

function LongText({ entityId, fieldId }: { readonly entityId: string; readonly fieldId: string }) {
  const links = useEntityLinks();
  const entity = useEntities().get(entityId);
  const fragment = links?.directory.textOf(entityId, fieldId) ?? null;
  // Запись сущности меняется при правке её текста — тогда и перечитываем.
  const nodes = useMemo(
    () => (fragment === null ? [] : fragmentToRich(fragment)),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- entity — признак изменения текста
    [fragment, entity],
  );
  return <RichTextView nodes={nodes} />;
}

/** Значение поля для показа; null — пусто. */
export function FieldValue({
  entity,
  field,
}: {
  readonly entity: Entity;
  readonly field: FieldWithId;
}) {
  if (field.kind === 'longText') return <LongText entityId={entity.id} fieldId={field.id} />;
  const value = fieldValue(field, entity.values);
  if (field.kind === 'relation') {
    const ids = selectedIds(field, entity.values);
    return ids.length === 0 ? null : <EntityChips ids={ids} />;
  }
  if (field.kind === 'select' || field.kind === 'multiSelect') {
    const chosen = new Set(selectedIds(field, entity.values));
    const options = optionsOf(field).filter((option) => chosen.has(option.id));
    if (options.length === 0) return null;
    return (
      <span className={styles.chips}>
        {options.map((option) => (
          <span
            key={option.id}
            className={styles.option}
            style={{ background: cardColor(option.color) }}
          >
            {optionName(option)}
          </span>
        ))}
      </span>
    );
  }
  if (value === undefined) return null;
  if (field.kind === 'image' && typeof value === 'string') return <FieldImage asset={value} />;
  if (typeof value === 'boolean')
    return <span>{value ? t('entities.yes') : t('entities.no')}</span>;
  if (typeof value === 'number') return <span>{formatNumber(value)}</span>;
  if (field.kind === 'date' && typeof value === 'string') return <span>{formatDate(value)}</span>;
  return typeof value === 'string' ? <span className={styles.plain}>{value}</span> : null;
}
