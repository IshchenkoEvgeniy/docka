import { describe, expect, it } from 'vitest';
import {
  BUILTIN_TYPE_IDS,
  EntityTypeSchema,
  backLinks,
  builtinEntityTypes,
  fieldValue,
  fieldsOf,
  mentionedIds,
  optionsOf,
  richTextToPlain,
  selectedIds,
  valueSchema,
  type Entity,
  type EntityType,
  type RichNode,
} from '.';

const types = new Map(builtinEntityTypes(0).map((type) => [type.id as string, type]));
function typeOf(id: string): EntityType {
  const type = types.get(id);
  if (type === undefined) throw new Error('нет типа');
  return type;
}
const npcType = typeOf(BUILTIN_TYPE_IDS.npc);

function entity(id: string, typeId: string, values: Record<string, unknown>): Entity {
  return {
    id,
    typeId,
    name: id,
    values,
    createdAt: 0,
    updatedAt: 0,
    deletedAt: null,
  } as Entity; // id в тестах — заведомо корректные строки
}

describe('встроенные типы', () => {
  it('проходят схему, поля по порядку, у связей — цели', () => {
    for (const type of types.values()) expect(EntityTypeSchema.safeParse(type).success).toBe(true);
    const fields = fieldsOf(npcType);
    expect(fields.map((field) => field.builtin)).toEqual([
      'npcPortrait',
      'npcRole',
      'npcDescription',
      'npcLocation',
      'npcItems',
    ]);
    expect(fields[3]).toMatchObject({ kind: 'relation', target: BUILTIN_TYPE_IDS.location });
    const kind = fieldsOf(typeOf(BUILTIN_TYPE_IDS.item))[1]; // поле «Тип»
    expect(kind === undefined ? [] : optionsOf(kind).map((option) => option.builtin)).toContain(
      'weapon',
    );
  });

  it('битое поле пропускается, а не ломает тип; скрытые поля — только по запросу', () => {
    const broken = {
      ...npcType,
      fields: {
        ...npcType.fields,
        'bad-field-1': { kind: 'hologram' },
        'npc-role': { ...(npcType.fields['npc-role'] as object), deletedAt: 5 },
      },
    };
    expect(fieldsOf(broken).map((field) => field.id)).not.toContain('bad-field-1');
    expect(fieldsOf(broken).map((field) => field.id)).not.toContain('npc-role');
    expect(fieldsOf(broken, true).map((field) => field.id)).toContain('npc-role');
  });
});

describe('значения полей', () => {
  const [, role, , location, items] = fieldsOf(npcType);
  if (role === undefined || location === undefined || items === undefined)
    throw new Error('нет полей');

  it('неподходящее значение не показывается, но и не мешает', () => {
    expect(fieldValue(role, { 'npc-role': 'Трактирщик' })).toBe('Трактирщик');
    expect(fieldValue(role, { 'npc-role': 42 })).toBeUndefined();
    expect(valueSchema({ kind: 'date' }).safeParse('2026-10-31').success).toBe(true);
    expect(valueSchema({ kind: 'date' }).safeParse('31.10.2026').success).toBe(false);
  });

  it('связи: одна — id, много — множество с отметками', () => {
    expect(selectedIds(location, { 'npc-location': 'tavern-0001' })).toEqual(['tavern-0001']);
    expect(
      selectedIds(items, { 'npc-items': { 'sword-0001': true, 'shield-001': false } }),
    ).toEqual(['sword-0001']);
  });

  it('обратные связи вычисляются по полям-связям', () => {
    const all = [
      entity('innkeeper', BUILTIN_TYPE_IDS.npc, { 'npc-location': 'tavern-0001' }),
      entity('cook-0001', BUILTIN_TYPE_IDS.npc, { 'npc-location': 'tavern-0001' }),
      {
        ...entity('ghost-001', BUILTIN_TYPE_IDS.npc, { 'npc-location': 'tavern-0001' }),
        deletedAt: 1,
      },
      entity('cellar-01', BUILTIN_TYPE_IDS.location, { 'location-parent': 'tavern-0001' }),
    ];
    expect(backLinks('tavern-0001', all, types)).toEqual([
      {
        typeId: BUILTIN_TYPE_IDS.npc,
        fieldId: 'npc-location',
        entityIds: ['innkeeper', 'cook-0001'],
      },
      { typeId: BUILTIN_TYPE_IDS.location, fieldId: 'location-parent', entityIds: ['cellar-01'] },
    ]);
  });
});

describe('упоминания', () => {
  const nodes: RichNode[] = [
    {
      type: 'element',
      name: 'paragraph',
      children: [
        { type: 'text', text: 'Спроси ' },
        {
          type: 'element',
          name: 'mention',
          attrs: { id: 'innkeeper', label: 'Борис' },
          children: [],
        },
      ],
    },
  ];
  it('находятся в тексте и выводятся в простой текст названием', () => {
    expect([...mentionedIds(nodes)]).toEqual(['innkeeper']);
    expect(richTextToPlain(nodes)).toBe('Спроси @Борис');
  });
});
