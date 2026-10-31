import * as Y from 'yjs';
import {
  EntitySchema,
  checkValues,
  err,
  fieldsOf,
  ok,
  planEntity,
  validate,
  type CommandEnvironment,
  type CommandResult,
  type Entity,
  type EntityCommand,
  type Result,
} from '../../core';
import { copyEntityTexts, createEntityTexts } from '../entityText';
import { ENTITIES_MAP } from '../projectDocument';
import { createRecord } from '../yjsRecords';
import { applyPatch, executeTypeCommand, isTypeCommand, readType } from './entityTypeCommands';
import { commit, prepareRecordPatch } from './recordPatch';

/** Команды сущностей проекта (ADR 0004). Каждая — одна транзакция документа проекта. */

type Command<K extends EntityCommand['kind']> = Extract<EntityCommand, { kind: K }>;

const entitiesOf = (doc: Y.Doc) => doc.getMap<unknown>(ENTITIES_MAP);
const NOT_FOUND = 'Сущность не найдена';

function recordOf(doc: Y.Doc, entityId: string): Y.Map<unknown> | null {
  const record = entitiesOf(doc).get(entityId);
  return record instanceof Y.Map ? (record as Y.Map<unknown>) : null; // записи — Y.Map
}

function readEntity(doc: Y.Doc, entityId: string): Entity | null {
  const record = recordOf(doc, entityId);
  if (record === null) return null;
  const parsed = validate(EntitySchema, record.toJSON());
  return parsed.ok ? parsed.value : null;
}

function createEntity(
  doc: Y.Doc,
  command: Command<'createEntity'>,
  environment: CommandEnvironment,
): Result<CommandResult> {
  const type = readType(doc, command.typeId);
  if (type?.deletedAt !== null) return err('Тип сущностей не найден');
  const entity = planEntity(command, type, environment);
  if (!entity.ok) return entity;
  const texts = fieldsOf(type)
    .filter((field) => field.kind === 'longText')
    .map((field) => field.id);
  commit(doc, [
    () => {
      const record = createRecord(entity.value);
      entitiesOf(doc).set(entity.value.id, record);
      createEntityTexts(record, texts);
    },
  ]);
  return ok({ createdId: entity.value.id });
}

function updateEntity(doc: Y.Doc, command: Command<'updateEntity'>, now: number) {
  const entity = readEntity(doc, command.entityId);
  const type = entity === null ? null : readType(doc, entity.typeId);
  if (entity === null || type === null) return err(NOT_FOUND);
  const values = checkValues(type, command.changes.values ?? {});
  if (!values.ok) return values;
  const name = command.changes.name?.trim();
  const changes = {
    ...(name === undefined ? {} : { name }),
    ...(command.changes.values === undefined ? {} : { values: values.value }),
    ...(command.changes.tags === undefined ? {} : { tags: command.changes.tags }),
    updatedAt: now,
  };
  return applyPatch(
    doc,
    prepareRecordPatch(entitiesOf(doc), command.entityId, EntitySchema, changes, NOT_FOUND),
  );
}

function setDeleted(doc: Y.Doc, entityId: string, deletedAt: number | null, now: number) {
  return applyPatch(
    doc,
    prepareRecordPatch(
      entitiesOf(doc),
      entityId,
      EntitySchema,
      { deletedAt, updatedAt: now },
      NOT_FOUND,
    ),
  );
}

function duplicateEntity(
  doc: Y.Doc,
  command: Command<'duplicateEntity'>,
  environment: CommandEnvironment,
): Result<CommandResult> {
  const source = recordOf(doc, command.entityId);
  const entity = readEntity(doc, command.entityId);
  if (source === null || entity === null) return err(NOT_FOUND);
  const now = environment.clock.now();
  const copy = validate(EntitySchema, {
    ...entity,
    id: environment.ids.next(),
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  });
  if (!copy.ok) return copy;
  commit(doc, [
    () => {
      const record = createRecord(copy.value);
      entitiesOf(doc).set(copy.value.id, record);
      copyEntityTexts(source, record);
    },
  ]);
  return ok({ createdId: copy.value.id });
}

/** Выполняет команду сущностей над документом проекта. Ошибка — ничего не изменено. */
export function executeEntityCommand(
  doc: Y.Doc,
  command: EntityCommand,
  environment: CommandEnvironment,
): Result<CommandResult> {
  if (isTypeCommand(command)) return executeTypeCommand(doc, command, environment);
  const now = environment.clock.now();
  switch (command.kind) {
    case 'createEntity':
      return createEntity(doc, command, environment);
    case 'updateEntity':
      return updateEntity(doc, command, now);
    case 'deleteEntity':
      return setDeleted(doc, command.entityId, now, now);
    case 'restoreEntity':
      return setDeleted(doc, command.entityId, null, now);
    case 'duplicateEntity':
      return duplicateEntity(doc, command, environment);
  }
}

const ENTITY_KINDS: readonly string[] = [
  'createEntity',
  'updateEntity',
  'deleteEntity',
  'restoreEntity',
  'duplicateEntity',
];

export function isEntityCommand(command: { readonly kind: string }): command is EntityCommand {
  return ENTITY_KINDS.includes(command.kind) || isTypeCommand(command as EntityCommand); // isTypeCommand смотрит только kind
}
