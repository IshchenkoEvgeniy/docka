import {
  FieldSchema,
  isBuiltinRelation,
  type BackLink,
  type EntityType,
  type Field,
  type FieldKind,
  type FieldOption,
} from '../core';
import { t } from '../i18n';

/**
 * Названия типов, полей и вариантов для показа. У встроенных, пока их не переименовали,
 * название пустое — текст берётся из перевода (ADR 0004).
 */

export function typeName(type: Pick<EntityType, 'name' | 'builtin'>): string {
  if (type.name !== '') return type.name;
  return type.builtin === null ? t('entities.untitled') : t(`entities.builtin.${type.builtin}`);
}

export function fieldName(field: Pick<Field, 'name' | 'builtin'>): string {
  if (field.name !== '') return field.name;
  return field.builtin === null ? t('entities.untitled') : t(`entities.builtin.${field.builtin}`);
}

export function optionName(option: Pick<FieldOption, 'name' | 'builtin'>): string {
  if (option.name !== '') return option.name;
  return option.builtin === null ? t('entities.untitled') : t(`entities.builtin.${option.builtin}`);
}

/** Подпись поля «Название» у сущностей типа («Имя» у НПС). */
export function nameLabel(type: Pick<EntityType, 'builtin'>): string {
  return t(`entities.nameLabel.${type.builtin ?? 'custom'}`);
}

export function kindName(kind: FieldKind): string {
  return t(`entities.kind.${kind}`);
}

export function entityName(name: string): string {
  return name === '' ? t('entities.unnamed') : name;
}

/** Подпись обратного списка («НПС здесь»): своя у поля, встроенная или «Тип: поле». */
export function backLinkName(link: BackLink, types: ReadonlyMap<string, EntityType>): string {
  const type = types.get(link.typeId);
  const parsed = FieldSchema.safeParse(type?.fields[link.fieldId]);
  const field = parsed.success ? parsed.data : null;
  if (field === null) return t('entities.untitled');
  if (field.backName !== undefined && field.backName !== '') return field.backName;
  const builtin = field.builtin;
  if (field.name === '' && isBuiltinRelation(builtin)) return t(`entities.back.${builtin}`);
  return t('entities.backOf', {
    type: type === undefined ? '' : typeName(type),
    field: fieldName(field),
  });
}
