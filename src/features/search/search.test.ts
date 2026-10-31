import { describe, expect, it } from 'vitest';
import * as Y from 'yjs';
import {
  BUILTIN_TYPE_IDS,
  createManualClock,
  createMemoryFileSystem,
  createSequentialIdGenerator,
  plainToRichText,
  type BoardId,
  type NewElement,
  type Tag,
  type TagId,
} from '../../core';
import { createProject, executeBoardCommand, executeProjectCommand } from '../../data';
import { elementDocs } from './searchDocs';
import { NO_FILTERS, createDocIndex, createSearchIndex } from './searchIndex';

const WORDS = ['таверна', 'кузнец', 'пещера', 'дракон', 'квест', 'мост', 'зелье', 'карта', 'склеп'];
const environment = () => ({ clock: createManualClock(1), ids: createSequentialIdGenerator('el') });
const NO_TAGS = new Map<string, Tag>();

function note(index: number, tagIds: TagId[] = []): NewElement {
  const a = WORDS[index % WORDS.length] ?? '';
  const b = WORDS[(index * 7) % WORDS.length] ?? '';
  return {
    type: 'note',
    placement: { x: index, y: 0, width: 200, height: 40 },
    data: {},
    richText: plainToRichText(`Заметка ${String(index)}: ${a} и ${b}`),
    tagIds,
  };
}

describe('поиск', () => {
  it('10 000 элементов: запрос быстрее 200 мс (приёмка этапа 6)', () => {
    const doc = new Y.Doc();
    const elements = Array.from({ length: 10_000 }, (_, index) => note(index));
    executeBoardCommand(
      doc,
      'board-0001' as BoardId,
      { kind: 'createElements', elements },
      environment(),
    ); // корректный id
    const index = createDocIndex();
    index.replace([], elementDocs(doc, 'board-0001'));
    for (const query of ['таверной', 'кузнецов', 'драк', 'пищера']) {
      const started = performance.now();
      const found = index.search(query, NO_FILTERS, NO_TAGS);
      expect(performance.now() - started).toBeLessThan(200);
      expect(found.length).toBeGreaterThan(0);
    }
  });

  it('словоформы, опечатки, фильтры по тегу и невыполненным задачам', () => {
    const doc = new Y.Doc();
    const world = { id: 'tag-world-1' as TagId, name: 'мир', color: 'red' } as const; // корректный id
    const city = { id: 'tag-city-01' as TagId, name: 'мир/город', color: 'red' } as const;
    const tags = new Map<string, Tag>([
      [world.id, world],
      [city.id, city],
    ]);
    executeBoardCommand(
      doc,
      'board-0001' as BoardId,
      {
        kind: 'createElements',
        elements: [
          { ...note(0, [city.id]), richText: plainToRichText('Таверна «Сытый гусь»') },
          { ...note(1), richText: plainToRichText('Кузнецы деревни') },
          {
            type: 'checklist',
            placement: { x: 0, y: 0, width: 200, height: 80 },
            data: { items: { a: { text: 'Найти козу', done: false, order: 1 } } },
          },
        ],
      },
      environment(),
    );
    const index = createDocIndex();
    index.replace([], elementDocs(doc, 'board-0001'));
    const titles = (query: string, filters = NO_FILTERS) =>
      index.search(query, filters, tags).map((doc) => doc.title);
    expect(titles('таверной')).toEqual(['Таверна «Сытый гусь»']);
    expect(titles('кузнецом')).toEqual(['Кузнецы деревни']);
    expect(titles('тоаверна')).toEqual(['Таверна «Сытый гусь»']);
    expect(titles('', { ...NO_FILTERS, tag: world.name })).toEqual(['Таверна «Сытый гусь»']);
    expect(
      index.search('', { ...NO_FILTERS, openTasks: true }, tags).map((doc) => doc.type),
    ).toEqual(['checklist']);
    expect(titles('')).toEqual([]);
  });

  it('по проекту: доски, сущности и элементы; перечитываются только изменённые доски', async () => {
    const ctx = {
      fs: createMemoryFileSystem(),
      deviceId: 'pc',
      clock: createManualClock(1),
      ids: createSequentialIdGenerator('p'),
    };
    const created = await createProject(ctx, 'Игра');
    if (!created.ok) throw new Error(created.error);
    const project = created.value;
    const root = project.meta.rootBoardId;
    executeProjectCommand(
      project.projectDoc.doc,
      { kind: 'createBoard', parentId: root, title: 'Локации мира' },
      ctx,
    );
    executeProjectCommand(
      project.projectDoc.doc,
      { kind: 'createEntity', typeId: BUILTIN_TYPE_IDS.npc, name: 'Борис' },
      ctx,
    );
    const board = await project.openBoard(root);
    executeBoardCommand(board.doc, root, { kind: 'createElements', elements: [note(0)] }, ctx);
    await project.closeBoard(root);
    const index = createSearchIndex(project);
    await index.refresh();
    const kinds = (query: string) =>
      index.search(query, NO_FILTERS, NO_TAGS).map((doc) => doc.kind);
    expect(kinds('локаций')).toEqual(['board']);
    expect(kinds('борис')).toEqual(['entity']);
    expect(kinds('таверна')).toEqual(['element']);
    expect(project.openBoardIds()).toEqual([]);
    await index.refresh();
    expect(kinds('таверна')).toEqual(['element']);
  });
});
