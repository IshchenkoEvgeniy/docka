import * as Y from 'yjs';
import {
  EntityTypeSchema,
  FieldSchema,
  err,
  ok,
  planEntityType,
  planField,
  storesFlags,
  validate,
  type CommandEnvironment,
  type CommandResult,
  type EntityCommand,
  type EntityType,
  type Result,
} from '../../core';
import { addFieldStorage } from '../entityText';
import { ENTITY_TYPES_MAP, readEntities } from '../projectDocument';
import { createRecord } from '../yjsRecords';
import { commit, merge, prepareRecordPatch } from './recordPatch';

/** Типы сущностей, их поля и варианты списков (ADR 0004). */

type Command<K extends EntityCommand['kind']> = Extract<EntityCommand, { kind: K }>;

const typesOf = (doc: Y.Doc) => doc.getMap<unknown>(ENTITY_TYPES_MAP);
const TYPE_NOT_FOUND = 'Тип сущностей не найден';

export function readType(doc: Y.Doc, typeId: string): EntityType | null {
  const record = typesOf(doc).get(typeId);
  if (!(record instanceof Y.Map)) return null;
  const parsed = validate(EntityTypeSchema, record.toJSON());
  return parsed.ok ? parsed.value : null;
}

export function applyPatch(doc: Y.Doc, prepared: Result<() => void>): Result<CommandResult> {
  if (!prepared.ok) return prepared;
  commit(doc, [prepared.value]);
  return ok({});
}

function patchType(
  doc: Y.Doc,
  typeId: string,
  changes: Readonly<Record<string, unknown>>,
  now: number,
): Result<() => void> {
  return prepareRecordPatch(
    typesOf(doc),
    typeId,
    EntityTypeSchema,
    { ...changes, updatedAt: now },
    TYPE_NOT_FOUND,
  );
}

/** Правка одного поля типа: поле после правки проверяется своей схемой. */
function patchField(
  doc: Y.Doc,
  typeId: string,
  fieldId: string,
  changes: Readonly<Record<string, unknown>>,
  now: number,
): Result<() => void> {
  const type = readType(doc, typeId);
  if (type === null) return err(TYPE_NOT_FOUND);
  const current = type.fields[fieldId];
  if (current === undefined) return err('Поле не найдено');
  const checked = validate(FieldSchema, merge(current, changes));
  if (!checked.ok) return err(`Некорректное поле: ${checked.error}`);
  return patchType(doc, typeId, { fields: { [fieldId]: changes } }, now);
}

function targetExists(doc: Y.Doc, target: string | null | undefined): boolean {
  return target === null || target === undefined || readType(doc, target) !== null;
}

function createType(
  doc: Y.Doc,
  command: Command<'createEntityType'>,
  environment: CommandEnvironment,
): Result<CommandResult> {
  const type = planEntityType(command, environment);
  if (!type.ok) return type;
  if (type.value.name === '') return err('У типа должно быть название');
  commit(doc, [() => typesOf(doc).set(type.value.id, createRecord(type.value))]);
  return ok({ createdId: type.value.id });
}

function deleteType(doc: Y.Doc, command: Command<'deleteEntityType'>, now: number) {
  const used = readEntities(doc).items.some(
    (entity) => entity.typeId === command.typeId && entity.deletedAt === null,
  );
  if (used) return err('У этого типа есть сущности — сначала удалите их');
  return applyPatch(doc, patchType(doc, command.typeId, { deletedAt: now }, now));
}

function addField(
  doc: Y.Doc,
  command: Command<'addField'>,
  environment: CommandEnvironment,
): Result<CommandResult> {
  const type = readType(doc, command.typeId);
  if (type === null) return err(TYPE_NOT_FOUND);
  if (!targetExists(doc, command.field.target)) return err(TYPE_NOT_FOUND);
  const planned = planField(type, command.field, environment);
  if (!planned.ok) return planned;
  const { id, field } = planned.value;
  const now = environment.clock.now();
  const prepared = patchType(doc, type.id, { fields: { [id]: field } }, now);
  if (!prepared.ok) return prepared;
  const storage = field.kind === 'longText' ? 'text' : storesFlags(field) ? 'flags' : null;
  commit(doc, [
    prepared.value,
    () => {
      if (storage !== null) addFieldStorage(doc, type.id, id, storage);
    },
  ]);
  return ok({ createdId: id });
}

function addOption(
  doc: Y.Doc,
  command: Command<'addFieldOption'>,
  environment: CommandEnvironment,
): Result<CommandResult> {
  const type = readType(doc, command.typeId);
  const field = validate(FieldSchema, type?.fields[command.fieldId]);
  if (!field.ok) return err('Поле не найдено');
  if (field.value.kind !== 'select' && field.value.kind !== 'multiSelect')
    return err('У этого поля нет вариантов');
  const name = command.name.trim();
  if (name === '') return err('У варианта должно быть название');
  const orders = Object.values(field.value.options ?? {}).map((option) => option.order);
  const id = environment.ids.next();
  const option = { name, builtin: null, order: Math.max(0, ...orders) + 1, color: 'default' };
  const now = environment.clock.now();
  const result = applyPatch(
    doc,
    patchField(doc, command.typeId, command.fieldId, { options: { [id]: option } }, now),
  );
  return result.ok ? ok({ createdId: id }) : result;
}

function updateOption(doc: Y.Doc, command: Command<'updateFieldOption'>, now: number) {
  const type = readType(doc, command.typeId);
  const field = validate(FieldSchema, type?.fields[command.fieldId]);
  if (!field.ok || field.value.options?.[command.optionId] === undefined)
    return err('Вариант не найден');
  const changes = { [command.optionId]: command.changes };
  return applyPatch(
    doc,
    patchField(doc, command.typeId, command.fieldId, { options: changes }, now),
  );
}

const TYPE_KINDS = [
  'createEntityType',
  'updateEntityType',
  'deleteEntityType',
  'addField',
  'updateField',
  'removeField',
  'restoreField',
  'addFieldOption',
  'updateFieldOption',
] as const;
type TypeCommand = Command<(typeof TYPE_KINDS)[number]>;

export function isTypeCommand(command: EntityCommand): command is TypeCommand {
  return TYPE_KINDS.some((kind) => kind === command.kind);
}

/** Команды типов сущностей. */
export function executeTypeCommand(
  doc: Y.Doc,
  command: TypeCommand,
  environment: CommandEnvironment,
): Result<CommandResult> {
  const now = environment.clock.now();
  switch (command.kind) {
    case 'createEntityType':
      return createType(doc, command, environment);
    case 'updateEntityType': {
      const name = command.changes.name?.trim();
      if (name === '') return err('У типа должно быть название');
      const changes = { ...command.changes, ...(name === undefined ? {} : { name }) };
      return applyPatch(doc, patchType(doc, command.typeId, changes, now));
    }
    case 'deleteEntityType':
      return deleteType(doc, command, now);
    case 'addField':
      return addField(doc, command, environment);
    case 'updateField':
      if (!targetExists(doc, command.changes.target)) return err(TYPE_NOT_FOUND);
      return applyPatch(
        doc,
        patchField(doc, command.typeId, command.fieldId, command.changes, now),
      );
    case 'removeField':
    case 'restoreField': {
      const deletedAt = command.kind === 'removeField' ? now : null;
      return applyPatch(doc, patchField(doc, command.typeId, command.fieldId, { deletedAt }, now));
    }
    case 'addFieldOption':
      return addOption(doc, command, environment);
    case 'updateFieldOption':
      return updateOption(doc, command, now);
  }
}
