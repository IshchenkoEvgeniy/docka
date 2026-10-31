import type { ColorName } from './color';
import type { EntityType, Field, FieldKind, FieldOption } from './entity';
import type { BuiltinFieldKey, BuiltinOptionKey, BuiltinTypeKey } from './entityBuiltinKeys';
import type { EntityTypeId, Timestamp } from './ids';

/**
 * Встроенные типы «НПС», «Локация», «Предмет» (ТЗ, раздел 6). Id постоянные: если два устройства
 * создадут их одновременно (миграция), Yjs сольёт одинаковые записи в одну.
 */
export const BUILTIN_TYPE_IDS: Readonly<Record<BuiltinTypeKey, EntityTypeId>> = {
  npc: 'builtin-npc' as EntityTypeId, // постоянные корректные id
  location: 'builtin-location' as EntityTypeId,
  item: 'builtin-item' as EntityTypeId,
};

interface FieldSeed {
  readonly id: string;
  readonly builtin: BuiltinFieldKey;
  readonly kind: FieldKind;
  readonly onCard: boolean;
  readonly target?: BuiltinTypeKey;
  readonly multiple?: boolean;
  readonly options?: readonly BuiltinOptionKey[];
}

const SEEDS: readonly {
  readonly key: BuiltinTypeKey;
  readonly icon: string;
  readonly color: ColorName;
  readonly fields: readonly FieldSeed[];
}[] = [
  {
    key: 'npc',
    icon: '🧙',
    color: 'yellow',
    fields: [
      { id: 'npc-portrait', builtin: 'npcPortrait', kind: 'image', onCard: true },
      { id: 'npc-role', builtin: 'npcRole', kind: 'text', onCard: true },
      { id: 'npc-description', builtin: 'npcDescription', kind: 'longText', onCard: true },
      {
        id: 'npc-location',
        builtin: 'npcLocation',
        kind: 'relation',
        onCard: true,
        target: 'location',
        multiple: false,
      },
      {
        id: 'npc-items',
        builtin: 'npcItems',
        kind: 'relation',
        onCard: false,
        target: 'item',
        multiple: true,
      },
    ],
  },
  {
    key: 'location',
    icon: '🏰',
    color: 'green',
    fields: [
      { id: 'location-image', builtin: 'locationImage', kind: 'image', onCard: true },
      {
        id: 'location-description',
        builtin: 'locationDescription',
        kind: 'longText',
        onCard: true,
      },
      {
        id: 'location-parent',
        builtin: 'locationParent',
        kind: 'relation',
        onCard: true,
        target: 'location',
        multiple: false,
      },
    ],
  },
  {
    key: 'item',
    icon: '🗡️',
    color: 'blue',
    fields: [
      { id: 'item-image', builtin: 'itemImage', kind: 'image', onCard: true },
      {
        id: 'item-kind',
        builtin: 'itemKind',
        kind: 'select',
        onCard: true,
        options: ['weapon', 'armor', 'consumable', 'quest', 'misc'],
      },
      { id: 'item-description', builtin: 'itemDescription', kind: 'longText', onCard: true },
      { id: 'item-stats', builtin: 'itemStats', kind: 'longText', onCard: false },
    ],
  },
];

function seedOptions(keys: readonly BuiltinOptionKey[]): Record<string, FieldOption> {
  return Object.fromEntries(
    keys.map((key, index) => [
      `option-${key}`,
      { name: '', builtin: key, order: index + 1, color: 'default' as const },
    ]),
  );
}

function seedField(seed: FieldSeed, order: number): Field {
  return {
    name: '',
    builtin: seed.builtin,
    kind: seed.kind,
    order,
    onCard: seed.onCard,
    deletedAt: null,
    ...(seed.target === undefined ? {} : { target: BUILTIN_TYPE_IDS[seed.target] }),
    ...(seed.multiple === undefined ? {} : { multiple: seed.multiple }),
    ...(seed.options === undefined ? {} : { options: seedOptions(seed.options) }),
  };
}

/** Записи встроенных типов для документа проекта (миграция к формату 2). */
export function builtinEntityTypes(now: Timestamp): EntityType[] {
  return SEEDS.map((seed) => ({
    id: BUILTIN_TYPE_IDS[seed.key],
    name: '',
    builtin: seed.key,
    icon: seed.icon,
    color: seed.color,
    fields: Object.fromEntries(
      seed.fields.map((field, index) => [field.id, seedField(field, index + 1)]),
    ),
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  }));
}
