import { z } from 'zod';
import { ColorNameSchema } from './color';
import {
  EntityIdSchema,
  EntityTypeIdSchema,
  KeySchema,
  TimestampSchema,
  type EntityId,
} from './ids';
import { BUILTIN_FIELD_KEYS, BUILTIN_OPTION_KEYS, BUILTIN_TYPE_KEYS } from './entityBuiltinKeys';

/**
 * Сущности проекта (ТЗ, раздел 6; ADR 0004): типы с полями и сами сущности.
 * Живут в документе проекта; на досках — только представления (элемент `entity`).
 */

export const FIELD_KINDS = [
  'text',
  'longText',
  'number',
  'boolean',
  'select',
  'multiSelect',
  'image',
  'date',
  'url',
  'relation',
] as const;
export type FieldKind = (typeof FIELD_KINDS)[number];

const LabelSchema = z.string().max(100);

export const FieldOptionSchema = z.object({
  /** Пустое у встроенного варианта, пока его не переименовали: текст — из перевода по builtin. */
  name: LabelSchema,
  builtin: z.enum(BUILTIN_OPTION_KEYS).nullable(),
  order: z.number(),
  color: ColorNameSchema,
  /** Вариант убран из списка; выбранные значения остаются в данных. */
  removed: z.boolean().optional(),
});
export type FieldOption = z.infer<typeof FieldOptionSchema>;

export const FieldSchema = z.object({
  name: LabelSchema,
  builtin: z.enum(BUILTIN_FIELD_KEYS).nullable(),
  /** Вид поля не меняется после создания: старые значения стали бы чужого вида. */
  kind: z.enum(FIELD_KINDS),
  order: z.number(),
  /** Показывать на карточке (вид «карточка»). */
  onCard: z.boolean(),
  /** Поле скрыто; значения сущностей хранятся до очистки корзины. */
  deletedAt: TimestampSchema.nullable(),
  /** Варианты для «список» и «несколько вариантов». */
  options: z.record(KeySchema, FieldOptionSchema).optional(),
  /** Связь: тип сущностей, на которые ссылается поле; null — любой. */
  target: EntityTypeIdSchema.nullable().optional(),
  /** Связь со многими сущностями (задаётся при создании поля). */
  multiple: z.boolean().optional(),
  /** Подпись обратного списка у связанной сущности («НПС здесь»). */
  backName: LabelSchema.optional(),
});
export type Field = z.infer<typeof FieldSchema>;
export type FieldWithId = Field & { readonly id: string };

export const EntityTypeSchema = z.object({
  id: EntityTypeIdSchema,
  name: LabelSchema,
  builtin: z.enum(BUILTIN_TYPE_KEYS).nullable(),
  /** Эмодзи или короткий символ. */
  icon: z.string().max(16),
  color: ColorNameSchema,
  /** Поля по id; каждое проверяется отдельно (fieldsOf): одно битое поле не ломает весь тип. */
  fields: z.record(z.string(), z.unknown()),
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
  deletedAt: TimestampSchema.nullable(),
});
export type EntityType = z.infer<typeof EntityTypeSchema>;

export const EntitySchema = z.object({
  id: EntityIdSchema,
  typeId: EntityTypeIdSchema,
  name: z.string().max(200),
  /** Значения полей по id поля; проверяются видом поля при чтении (fieldValue). */
  values: z.record(z.string(), z.unknown()),
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
  deletedAt: TimestampSchema.nullable(),
});
export type Entity = z.infer<typeof EntitySchema>;

/** Множество id: `id → true`; снятая отметка — false (не воскресает при слиянии). */
const FlagsSchema = z.record(z.string(), z.boolean());

/** Схема значения поля. Длинный текст лежит не в values, а в Yjs-тексте сущности (ADR 0004). */
export function valueSchema(field: Pick<Field, 'kind' | 'multiple'>): z.ZodType {
  switch (field.kind) {
    case 'text':
      return z.string().max(2000);
    case 'longText':
      return z.never();
    case 'number':
      return z.number().min(-1e15).max(1e15);
    case 'boolean':
      return z.boolean();
    case 'select':
      return KeySchema;
    case 'multiSelect':
      return FlagsSchema;
    case 'image':
      return z.string().max(80);
    case 'date':
      return z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
    case 'url':
      return z.string().max(2000);
    case 'relation':
      return field.multiple === true ? FlagsSchema : EntityIdSchema;
  }
}

/** Значение поля сущности или undefined (пусто или не подходит полю — данные не трогаются). */
export function fieldValue(field: FieldWithId, values: Readonly<Record<string, unknown>>): unknown {
  const raw = values[field.id];
  if (raw === undefined || raw === null) return undefined;
  const parsed = valueSchema(field).safeParse(raw);
  return parsed.success ? parsed.data : undefined;
}

/** Выбранные id: варианты списка или связанные сущности (в порядке ключей). */
export function selectedIds(
  field: FieldWithId,
  values: Readonly<Record<string, unknown>>,
): string[] {
  const value = fieldValue(field, values);
  if (typeof value === 'string') return [value];
  if (typeof value !== 'object' || value === null) return [];
  return Object.entries(value as Record<string, boolean>) // схема FlagsSchema
    .filter(([, on]) => on)
    .map(([id]) => id);
}

/** Поля типа: проверенные, по порядку; hidden — включая скрытые (удалённые). */
export function fieldsOf(type: EntityType, hidden = false): FieldWithId[] {
  const fields: FieldWithId[] = [];
  for (const [id, raw] of Object.entries(type.fields)) {
    const parsed = FieldSchema.safeParse(raw);
    if (!parsed.success || !KeySchema.safeParse(id).success) continue;
    if (!hidden && parsed.data.deletedAt !== null) continue;
    fields.push({ ...parsed.data, id });
  }
  return fields.sort((a, b) => a.order - b.order || (a.id < b.id ? -1 : 1));
}

/** Варианты поля-списка по порядку, без убранных. */
export function optionsOf(field: Field): (FieldOption & { readonly id: string })[] {
  return Object.entries(field.options ?? {})
    .filter(([, option]) => option.removed !== true)
    .map(([id, option]) => ({ ...option, id }))
    .sort((a, b) => a.order - b.order || (a.id < b.id ? -1 : 1));
}

/** Обратная связь: сущности типа typeId, чьё поле fieldId указывает на данную. */
export interface BackLink {
  readonly typeId: string;
  readonly fieldId: string;
  readonly entityIds: readonly EntityId[];
}

/**
 * Обратные связи вычисляются, а не хранятся (ADR 0004): у «Таверны» — все НПС,
 * чьё поле «Локация» указывает на неё.
 */
export function backLinks(
  entityId: string,
  entities: Iterable<Entity>,
  types: ReadonlyMap<string, EntityType>,
): BackLink[] {
  const groups = new Map<string, { typeId: string; fieldId: string; entityIds: EntityId[] }>();
  for (const entity of entities) {
    const type = types.get(entity.typeId);
    if (entity.deletedAt !== null || type === undefined) continue;
    for (const field of fieldsOf(type)) {
      if (field.kind !== 'relation' || !selectedIds(field, entity.values).includes(entityId))
        continue;
      const key = `${type.id}/${field.id}`;
      const group = groups.get(key) ?? { typeId: type.id, fieldId: field.id, entityIds: [] };
      group.entityIds.push(entity.id);
      groups.set(key, group);
    }
  }
  return [...groups.values()];
}
