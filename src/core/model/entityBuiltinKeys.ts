/**
 * Ключи встроенных типов, полей и вариантов. Названия встроенных хранятся пустыми, а текст
 * берётся из перевода по ключу (ADR 0004), пока пользователь не переименует.
 */
export const BUILTIN_TYPE_KEYS = ['npc', 'location', 'item'] as const;
export type BuiltinTypeKey = (typeof BUILTIN_TYPE_KEYS)[number];

/** Поля-связи встроенных типов: у них есть подпись обратного списка. */
export const BUILTIN_RELATION_KEYS = ['npcLocation', 'npcItems', 'locationParent'] as const;
export type BuiltinRelationKey = (typeof BUILTIN_RELATION_KEYS)[number];

export const BUILTIN_FIELD_KEYS = [
  'npcPortrait',
  'npcRole',
  'npcDescription',
  'locationImage',
  'locationDescription',
  'itemImage',
  'itemKind',
  'itemDescription',
  'itemStats',
  ...BUILTIN_RELATION_KEYS,
] as const;
export type BuiltinFieldKey = (typeof BUILTIN_FIELD_KEYS)[number];

export const BUILTIN_OPTION_KEYS = ['weapon', 'armor', 'consumable', 'quest', 'misc'] as const;
export type BuiltinOptionKey = (typeof BUILTIN_OPTION_KEYS)[number];

export function isBuiltinRelation(key: string | null): key is BuiltinRelationKey {
  return BUILTIN_RELATION_KEYS.some((relation) => relation === key);
}
