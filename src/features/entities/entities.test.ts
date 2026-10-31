import { describe, expect, it } from 'vitest';
import * as Y from 'yjs';
import {
  BUILTIN_TYPE_IDS,
  createManualClock,
  createSequentialIdGenerator,
  plainToRichText,
  type BoardId,
  type RichNode,
} from '../../core';
import { MIGRATIONS, executeBoardCommand } from '../../data';
import { filterAndSort } from './librarySort';
import { createProjectEntities } from './projectEntities';
import { scanBoard } from './usage';

const environment = () => ({ clock: createManualClock(1), ids: createSequentialIdGenerator('e') });

function project() {
  const doc = new Y.Doc();
  MIGRATIONS[0]?.migrateProjectDoc?.(doc);
  const entities = createProjectEntities(doc, environment());
  const create = (name: string, values: Record<string, unknown> = {}) => {
    const result = entities.run({
      kind: 'createEntity',
      typeId: BUILTIN_TYPE_IDS.npc,
      name,
      values,
    });
    if (!result.ok || result.value.createdId === undefined) throw new Error('не создана');
    return result.value.createdId;
  };
  return { entities, create };
}

const mention = (id: string): RichNode[] => [
  {
    type: 'element',
    name: 'paragraph',
    children: [{ type: 'element', name: 'mention', attrs: { id, label: 'Борис' }, children: [] }],
  },
];

describe('использование сущности', () => {
  it('считает карточки и упоминания на доске', () => {
    const board = new Y.Doc();
    const id = 'npc-borisx';
    executeBoardCommand(
      board,
      'board-0001' as BoardId, // корректный id
      {
        kind: 'createElements',
        elements: [
          {
            type: 'entity',
            placement: { x: 0, y: 0, width: 200, height: 40 },
            data: { entityId: id, view: 'chip' },
          },
          {
            type: 'entity',
            placement: { x: 0, y: 90, width: 200, height: 40 },
            data: { entityId: id, view: 'card' },
          },
          {
            type: 'note',
            placement: { x: 0, y: 200, width: 200, height: 40 },
            data: {},
            richText: mention(id),
          },
          {
            type: 'note',
            placement: { x: 0, y: 300, width: 200, height: 40 },
            data: {},
            richText: plainToRichText('Борис'),
          },
        ],
      },
      environment(),
    );
    expect(scanBoard(board).get(id)).toEqual({ placements: 2, mentions: 1 });
  });
});

describe('библиотека', () => {
  it('фильтр по названию и сортировка по полю, пустые — в конце', () => {
    const { entities, create } = project();
    create('Борис', { 'npc-role': 'Трактирщик' });
    create('Анна', { 'npc-role': 'Кузнец' });
    create('Ведьма');
    const snapshot = entities.stores.entities.getSnapshot();
    const types = entities.stores.types.getSnapshot();
    const names = (typeId: string | null, query: string, key: string, descending = false) =>
      filterAndSort(snapshot, types, { typeId, query, sort: { key, descending } }, () => '').map(
        (entity) => entity.name,
      );
    expect(names(null, '', 'name')).toEqual(['Анна', 'Борис', 'Ведьма']);
    expect(names(BUILTIN_TYPE_IDS.npc, '', 'npc-role')).toEqual(['Анна', 'Борис', 'Ведьма']);
    expect(names(BUILTIN_TYPE_IDS.npc, '', 'npc-role', true)).toEqual(['Борис', 'Анна', 'Ведьма']);
    expect(names(null, 'бор', 'name')).toEqual(['Борис']);
    entities.destroy();
  });
});
