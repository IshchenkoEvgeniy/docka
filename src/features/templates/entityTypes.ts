import type * as Y from 'yjs';
import {
  BUILTIN_TYPE_IDS,
  type CommandEnvironment,
  type EntityTypeId,
  type ProjectCommand,
  type TemplateEntityType,
} from '../../core';
import { executeProjectCommand, readEntityTypes } from '../../data';

/**
 * Типы сущностей шаблона в проекте: встроенные берутся готовыми, тип с тем же названием —
 * существующий (поля не дублируются), остальные создаются. Связи — вторым проходом,
 * когда известны все типы.
 */
export function ensureEntityTypes(
  doc: Y.Doc,
  environment: CommandEnvironment,
  types: readonly TemplateEntityType[],
): Map<string, EntityTypeId> {
  const run = (command: ProjectCommand) => executeProjectCommand(doc, command, environment);
  const existing = () => readEntityTypes(doc).items.filter((type) => type.deletedAt === null);
  const keys = new Map<string, EntityTypeId>();
  const created: TemplateEntityType[] = [];
  for (const type of types) {
    if (type.builtin !== undefined) {
      keys.set(type.key, BUILTIN_TYPE_IDS[type.builtin]);
      continue;
    }
    const same = existing().find(
      (item) => item.name.toLocaleLowerCase() === type.name.toLocaleLowerCase(),
    );
    if (same !== undefined) {
      keys.set(type.key, same.id);
      continue;
    }
    const result = run({
      kind: 'createEntityType',
      name: type.name,
      icon: type.icon,
      color: type.color,
    });
    const id = existing().find(
      (item) => item.id === (result.ok ? result.value.createdId : null),
    )?.id;
    if (id === undefined) continue;
    keys.set(type.key, id);
    created.push(type);
  }
  for (const relations of [false, true])
    for (const type of created) addFields(run, keys, type, relations);
  return keys;
}

function addFields(
  run: (command: ProjectCommand) => ReturnType<typeof executeProjectCommand>,
  keys: ReadonlyMap<string, EntityTypeId>,
  type: TemplateEntityType,
  relations: boolean,
): void {
  const typeId = keys.get(type.key);
  if (typeId === undefined) return;
  for (const field of type.fields.filter((item) => (item.kind === 'relation') === relations)) {
    const target = field.target === undefined ? null : (keys.get(field.target) ?? null);
    const added = run({
      kind: 'addField',
      typeId,
      field: { name: field.name, kind: field.kind, target, multiple: field.multiple ?? false },
    });
    if (!added.ok || added.value.createdId === undefined) continue;
    const fieldId = added.value.createdId;
    run({
      kind: 'updateField',
      typeId,
      fieldId,
      changes: {
        onCard: field.onCard ?? false,
        ...(field.backName === undefined ? {} : { backName: field.backName }),
      },
    });
    for (const name of field.options ?? []) run({ kind: 'addFieldOption', typeId, fieldId, name });
  }
}
