import { describe, expect, it } from 'vitest';
import * as Y from 'yjs';
import {
  BUILTIN_TYPE_IDS,
  TRASH_RETENTION_MS,
  createManualClock,
  createSequentialIdGenerator,
  fieldsOf,
  plainToRichText,
  type EntityId,
  type EntityTypeId,
  type ProjectCommand,
} from '../../core';
import { MIGRATIONS } from '../migrations';
import { ensureEntityText, entityTextOf } from '../entityText';
import { readEntities, readEntityTypes } from '../projectDocument';
import { fillFragment, fragmentToRich } from '../richText';
import { purgeEntities } from '../trashPurge';
import { combineUndoHistories } from './combinedUndo';
import { executeProjectCommand } from './projectCommands';
import { LOCAL_ORIGIN } from './recordPatch';
import { createUndoHistory } from './undo';

function setup(prefix = 'obj') {
  const doc = new Y.Doc();
  MIGRATIONS[0]?.migrateProjectDoc?.(doc);
  const environment = { clock: createManualClock(1000), ids: createSequentialIdGenerator(prefix) };
  const run = (command: ProjectCommand) => executeProjectCommand(doc, command, environment);
  const created = (command: ProjectCommand): string => {
    const result = run(command);
    if (!result.ok || result.value.createdId === undefined) throw new Error('не создано');
    return result.value.createdId;
  };
  const entity = (id: string) => readEntities(doc).items.find((item) => item.id === id);
  return { doc, run, created, entity, environment };
}

const NPC = BUILTIN_TYPE_IDS.npc;
const asEntity = (id: string) => id as EntityId; // id из результата команды

describe('типы сущностей и поля', () => {
  it('свой тип: поля всех видов, варианты списка, скрытие поля', () => {
    const { created, run, doc } = setup();
    const typeId = created({ kind: 'createEntityType', name: 'Квест', icon: '📜', color: 'red' });
    const id = typeId as EntityTypeId; // создан выше
    const kinds = ['text', 'number', 'boolean', 'multiSelect', 'date', 'url'] as const;
    for (const kind of kinds)
      created({ kind: 'addField', typeId: id, field: { name: kind, kind } });
    const tags = fieldsOf(readEntityTypes(doc).items.find((t) => t.id === id) ?? never())[3];
    const option = created({
      kind: 'addFieldOption',
      typeId: id,
      fieldId: tags?.id ?? '',
      name: 'Главный',
    });
    const type = () => readEntityTypes(doc).items.find((t) => t.id === id) ?? never();
    expect(fieldsOf(type()).map((field) => field.kind)).toEqual([...kinds]);
    expect(fieldsOf(type())[3]?.options?.[option]).toMatchObject({ name: 'Главный' });
    expect(run({ kind: 'removeField', typeId: id, fieldId: tags?.id ?? '' }).ok).toBe(true);
    expect(fieldsOf(type())).toHaveLength(5);
    expect(fieldsOf(type(), true)).toHaveLength(6);
    expect(run({ kind: 'addField', typeId: id, field: { name: ' ', kind: 'text' } }).ok).toBe(
      false,
    );
  });

  it('тип с сущностями удалить нельзя', () => {
    const { created, run } = setup();
    const id = created({ kind: 'createEntity', typeId: NPC, name: 'Борис' });
    expect(run({ kind: 'deleteEntityType', typeId: NPC }).ok).toBe(false);
    run({ kind: 'deleteEntity', entityId: asEntity(id) });
    expect(run({ kind: 'deleteEntityType', typeId: NPC }).ok).toBe(true);
  });
});

describe('сущности', () => {
  it('создаются с текстами полей, значения проверяются видом поля', () => {
    const { created, run, entity, doc } = setup();
    const id = created({
      kind: 'createEntity',
      typeId: NPC,
      name: ' Борис ',
      values: { 'npc-role': 'Кузнец' },
    });
    expect(entity(id)).toMatchObject({ name: 'Борис', values: { 'npc-role': 'Кузнец' } });
    expect(entityTextOf(doc, id, 'npc-description')).not.toBeNull();
    const update = (values: Record<string, unknown>) =>
      run({ kind: 'updateEntity', entityId: asEntity(id), changes: { values } });
    expect(update({ 'npc-role': 5 }).ok).toBe(false);
    expect(update({ 'no-such-field': 'x' }).ok).toBe(false);
    expect(update({ 'npc-role': null }).ok).toBe(true);
    expect(entity(id)?.values['npc-role']).toBeNull();
  });

  it('отметки «много» с двух устройств сливаются', () => {
    const pc = setup('pc');
    const id = pc.created({ kind: 'createEntity', typeId: NPC, name: 'Борис' });
    const phone = setup('phone');
    Y.applyUpdate(phone.doc, Y.encodeStateAsUpdate(pc.doc));
    pc.run({
      kind: 'updateEntity',
      entityId: asEntity(id),
      changes: { values: { 'npc-items': { 'sword-0001': true } } },
    });
    phone.run({
      kind: 'updateEntity',
      entityId: asEntity(id),
      changes: { values: { 'npc-items': { 'shield-001': true } } },
    });
    phone.run({ kind: 'updateEntity', entityId: asEntity(id), changes: { name: 'Борис Кузнец' } });
    Y.applyUpdate(pc.doc, Y.encodeStateAsUpdate(phone.doc));
    expect(pc.entity(id)).toMatchObject({
      name: 'Борис Кузнец',
      values: { 'npc-items': { 'sword-0001': true, 'shield-001': true } },
    });
  });

  it('независимая копия — со своими текстами', () => {
    const { created, doc, entity } = setup();
    const id = created({ kind: 'createEntity', typeId: NPC, name: 'Борис' });
    const text = entityTextOf(doc, id, 'npc-description');
    if (text === null) throw new Error('нет текста');
    fillFragment(text, plainToRichText('Знает про пещеру'));
    const copy = created({ kind: 'duplicateEntity', entityId: asEntity(id) });
    expect(entity(copy)?.name).toBe('Борис');
    const copied = entityTextOf(doc, copy, 'npc-description');
    expect(copied === null ? null : fragmentToRich(copied)).toEqual(
      plainToRichText('Знает про пещеру'),
    );
    expect(copied).not.toBe(text);
  });

  it('текст поля, добавленного позже, есть у старых сущностей; без него — создаётся при правке', () => {
    const { created, doc } = setup();
    const id = created({ kind: 'createEntity', typeId: NPC, name: 'Борис' });
    const later = created({
      kind: 'addField',
      typeId: NPC,
      field: { name: 'Слухи', kind: 'longText' },
    });
    expect(entityTextOf(doc, id, later)).not.toBeNull();
    doc.transact(() => {
      const record = doc.getMap('entities').get(id) as Y.Map<unknown>; // запись создана выше
      record.delete('texts');
    });
    expect(entityTextOf(doc, id, later)).toBeNull();
    expect(ensureEntityText(doc, id, later)).toBe(entityTextOf(doc, id, later));
  });
});

describe('корзина и отмена', () => {
  it('через 30 дней удаляются сущности, тип без сущностей и значения скрытых полей', () => {
    const { created, run, doc, entity } = setup();
    const kept = created({
      kind: 'createEntity',
      typeId: NPC,
      name: 'Борис',
      values: { 'npc-role': 'Кузнец' },
    });
    const gone = created({ kind: 'createEntity', typeId: NPC, name: 'Призрак' });
    run({ kind: 'deleteEntity', entityId: asEntity(gone) });
    run({ kind: 'removeField', typeId: NPC, fieldId: 'npc-role' });
    expect(purgeEntities(doc, 1000 + TRASH_RETENTION_MS - 1)).toBe(0);
    expect(purgeEntities(doc, 1000 + TRASH_RETENTION_MS)).toBe(2);
    expect(entity(gone)).toBeUndefined();
    expect(entity(kept)?.values).toEqual({ 'npc-items': {} });
    const npc = readEntityTypes(doc).items.find((type) => type.id === NPC);
    expect(npc?.fields['npc-role']).toBeUndefined();
  });

  it('общая история: шаги доски и сущностей отменяются по порядку', () => {
    const { created, run, doc, entity } = setup();
    const board = new Y.Doc();
    const boardHistory = createUndoHistory(board, ['elements']);
    const projectHistory = createUndoHistory(doc, ['entities', 'entityTypes']);
    const history = combineUndoHistories([boardHistory, projectHistory]);
    const id = created({ kind: 'createEntity', typeId: NPC, name: 'Борис' });
    board.transact(() => board.getMap('elements').set('a', 1), LOCAL_ORIGIN);
    run({ kind: 'updateEntity', entityId: asEntity(id), changes: { name: 'Борис Кузнец' } });
    expect(history.undo()).toBe(true);
    expect(entity(id)?.name).toBe('Борис');
    expect(board.getMap('elements').get('a')).toBe(1);
    expect(history.undo()).toBe(true);
    expect(board.getMap('elements').has('a')).toBe(false);
    expect(history.redo()).toBe(true);
    expect(board.getMap('elements').get('a')).toBe(1);
    expect(history.canRedo()).toBe(true);
    history.batch(() => {
      run({ kind: 'updateEntity', entityId: asEntity(id), changes: { name: 'Копия' } });
      board.transact(() => board.getMap('elements').set('b', 2), LOCAL_ORIGIN);
    });
    expect(history.undo()).toBe(true);
    expect(entity(id)?.name).toBe('Борис');
    expect(board.getMap('elements').has('b')).toBe(false);
    history.redo();
    run({ kind: 'updateEntity', entityId: asEntity(id), changes: { name: 'Третий' } });
    projectHistory.undo(); // напрямую, мимо общей истории
    expect(history.undo()).toBe(true);
    expect(entity(id)?.name).toBe('Борис');
    expect(board.getMap('elements').has('b')).toBe(false);
    history.destroy();
  });
});

function never(): never {
  throw new Error('не найдено');
}
