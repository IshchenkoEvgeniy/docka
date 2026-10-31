import { err, ok, type Result } from '../result';
import {
  EntitySchema,
  EntityTypeSchema,
  FieldSchema,
  fieldsOf,
  validate,
  valueSchema,
  type ColorName,
  type Entity,
  type EntityId,
  type EntityType,
  type EntityTypeId,
  type Field,
  type FieldKind,
} from '../model';
import type { CommandEnvironment } from './environment';

/** Команды сущностей и их типов (документ проекта, ADR 0004). */

export interface NewField {
  readonly name: string;
  readonly kind: FieldKind;
  /** Связь: тип сущностей-целей; null — любой. */
  readonly target?: EntityTypeId | null;
  readonly multiple?: boolean;
}

interface TypeChanges {
  readonly name?: string;
  readonly icon?: string;
  readonly color?: ColorName;
}

export type EntityCommand =
  | {
      readonly kind: 'createEntityType';
      readonly name: string;
      readonly icon: string;
      readonly color: ColorName;
    }
  | {
      readonly kind: 'updateEntityType';
      readonly typeId: EntityTypeId;
      readonly changes: TypeChanges;
    }
  /** Только тип без сущностей: иначе они остались бы без полей. */
  | { readonly kind: 'deleteEntityType'; readonly typeId: EntityTypeId }
  | { readonly kind: 'addField'; readonly typeId: EntityTypeId; readonly field: NewField }
  | {
      readonly kind: 'updateField';
      readonly typeId: EntityTypeId;
      readonly fieldId: string;
      readonly changes: {
        readonly name?: string;
        readonly onCard?: boolean;
        readonly order?: number;
        readonly target?: EntityTypeId | null;
        readonly backName?: string;
      };
    }
  /** Скрыть поле: значения остаются до очистки корзины. */
  | { readonly kind: 'removeField'; readonly typeId: EntityTypeId; readonly fieldId: string }
  | { readonly kind: 'restoreField'; readonly typeId: EntityTypeId; readonly fieldId: string }
  | {
      readonly kind: 'addFieldOption';
      readonly typeId: EntityTypeId;
      readonly fieldId: string;
      readonly name: string;
    }
  | {
      readonly kind: 'updateFieldOption';
      readonly typeId: EntityTypeId;
      readonly fieldId: string;
      readonly optionId: string;
      readonly changes: {
        readonly name?: string;
        readonly color?: ColorName;
        readonly removed?: boolean;
      };
    }
  | {
      readonly kind: 'createEntity';
      readonly typeId: EntityTypeId;
      readonly name: string;
      readonly values?: Readonly<Record<string, unknown>>;
    }
  | {
      readonly kind: 'updateEntity';
      readonly entityId: EntityId;
      readonly changes: {
        readonly name?: string;
        /** По id поля; null — очистить. Множества — `{ id: true/false }`, сливаются по ключам. */
        readonly values?: Readonly<Record<string, unknown>>;
      };
    }
  | { readonly kind: 'deleteEntity'; readonly entityId: EntityId }
  | { readonly kind: 'restoreEntity'; readonly entityId: EntityId }
  /** Независимая копия: те же поля и тексты, новый id. */
  | { readonly kind: 'duplicateEntity'; readonly entityId: EntityId };

export function planEntityType(
  command: Extract<EntityCommand, { kind: 'createEntityType' }>,
  environment: CommandEnvironment,
): Result<EntityType> {
  const now = environment.clock.now();
  return validate(EntityTypeSchema, {
    id: environment.ids.next(),
    name: command.name.trim(),
    builtin: null,
    icon: command.icon,
    color: command.color,
    fields: {},
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  });
}

/** Новое поле в конце списка; первые четыре поля по умолчанию видны на карточке. */
export function planField(
  type: EntityType,
  input: NewField,
  environment: CommandEnvironment,
): Result<{ readonly id: string; readonly field: Field }> {
  const existing = fieldsOf(type);
  const order = Math.max(0, ...existing.map((field) => field.order)) + 1;
  const relation = input.kind === 'relation';
  const field = validate(FieldSchema, {
    name: input.name.trim(),
    builtin: null,
    kind: input.kind,
    order,
    onCard: existing.filter((item) => item.onCard).length < 4,
    deletedAt: null,
    ...(relation ? { target: input.target ?? null, multiple: input.multiple ?? false } : {}),
    ...(input.kind === 'select' || input.kind === 'multiSelect' ? { options: {} } : {}),
  });
  if (!field.ok) return field;
  if (field.value.name === '') return err('У поля должно быть название');
  return ok({ id: environment.ids.next(), field: field.value });
}

/** Проверяет значения по полям типа: поле должно существовать, значение — подходить ему. */
export function checkValues(
  type: EntityType,
  values: Readonly<Record<string, unknown>>,
): Result<Record<string, unknown>> {
  const fields = new Map(fieldsOf(type, true).map((field) => [field.id, field]));
  const checked: Record<string, unknown> = {};
  for (const [id, value] of Object.entries(values)) {
    const field = fields.get(id);
    if (field === undefined) return err('Поле не найдено');
    if (value === null) {
      checked[id] = null;
      continue;
    }
    // Для множеств проверяется сама правка (часть ключей), слияние — по ключам.
    const parsed = valueSchema(field).safeParse(value);
    if (!parsed.success) return err('Значение не подходит полю');
    checked[id] = parsed.data;
  }
  return ok(checked);
}

/** Поле хранит множество (несколько вариантов, связь «много»): `id → true/false`. */
export function storesFlags(field: Pick<Field, 'kind' | 'multiple'>): boolean {
  return field.kind === 'multiSelect' || (field.kind === 'relation' && field.multiple === true);
}

export function planEntity(
  command: Extract<EntityCommand, { kind: 'createEntity' }>,
  type: EntityType,
  environment: CommandEnvironment,
): Result<Entity> {
  const values = checkValues(type, command.values ?? {});
  if (!values.ok) return values;
  const now = environment.clock.now();
  // Пустые множества — сразу: иначе два устройства создали бы их одновременно, и Yjs оставил бы одно.
  const flags = fieldsOf(type)
    .filter(storesFlags)
    .map((field) => [field.id, {}] as const);
  return validate(EntitySchema, {
    id: environment.ids.next(),
    typeId: type.id,
    name: command.name.trim(),
    values: { ...Object.fromEntries(flags), ...values.value },
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  });
}
