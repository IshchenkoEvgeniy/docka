import { describe, expect, it } from 'vitest';
import * as Y from 'yjs';
import {
  BUILTIN_TYPE_IDS,
  createManualClock,
  createSequentialIdGenerator,
  type BoardId,
  type EntityId,
} from '../../core';
import { MIGRATIONS, createUndoHistory, executeProjectCommand, readEntities } from '../../data';
import { NO_HOST } from './host';
import { createBoardModel } from './model';
import { entityPayload } from './references';
import { pastePayload } from './boardActions';
import { placeWithCopies } from './references';

function setup() {
  const environment = { clock: createManualClock(1), ids: createSequentialIdGenerator('el') };
  const projectDoc = new Y.Doc();
  MIGRATIONS[0]?.migrateProjectDoc?.(projectDoc);
  const history = createUndoHistory(projectDoc, ['entities', 'entityTypes']);
  const run = (command: Parameters<typeof executeProjectCommand>[1]) =>
    executeProjectCommand(projectDoc, command, environment);
  const created = run({ kind: 'createEntity', typeId: BUILTIN_TYPE_IDS.npc, name: 'Борис' });
  const entityId = (created.ok ? created.value.createdId : '') as EntityId; // создана выше
  const exists = (id: string) => readEntities(projectDoc).items.some((e) => e.id === id);
  const model = createBoardModel(new Y.Doc(), 'board-0001' as BoardId, environment, {
    ...NO_HOST,
    entities: {
      exists,
      duplicate: (id) => {
        const copy = run({ kind: 'duplicateEntity', entityId: id as EntityId }); // id проверен exists
        return copy.ok ? (copy.value.createdId ?? null) : null;
      },
      history,
      openLibrary: () => undefined,
    },
  });
  const placed = () =>
    [...model.elements.getSnapshot().values()].map((element) => element.data.entityId);
  return { model, entityId, projectDoc, placed };
}

describe('карточки сущностей: ссылка или копия', () => {
  it('из библиотеки кладётся ссылка без вопроса', () => {
    const { model, entityId, placed } = setup();
    pastePayload(model, entityPayload(entityId), { x: 0, y: 0 }, false);
    expect(placed()).toEqual([entityId]);
    expect(model.overlay.getState().dialog).toBeNull();
  });

  it('вставка спрашивает; независимая копия — новая сущность, один шаг отмены', () => {
    const { model, entityId, placed, projectDoc } = setup();
    pastePayload(model, entityPayload(entityId), { x: 0, y: 0 });
    const dialog = model.overlay.getState().dialog;
    if (dialog?.kind !== 'references') throw new Error('нет вопроса');
    placeWithCopies(model, dialog.elements);
    const [copy] = placed();
    expect(copy).not.toBe(entityId);
    expect(readEntities(projectDoc).items).toHaveLength(2);
    model.undo.undo();
    expect(placed()).toEqual([]);
    expect(readEntities(projectDoc).items).toHaveLength(1);
  });
});
