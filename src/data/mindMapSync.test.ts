import { describe, expect, it } from 'vitest';
import * as Y from 'yjs';
import {
  buildMindMapForest,
  createManualClock,
  createSequentialIdGenerator,
  type BoardId,
  type ElementId,
  type MindMapLink,
} from '../core';
import { executeBoardCommand } from './commands';
import { readElements } from './projectDocument';
import { updateRecord, type RecordMap } from './yjsRecords';

const BOARD = 'board-quests' as BoardId; // тестовая доска
const environment = {
  clock: createManualClock(100),
  ids: createSequentialIdGenerator('pc'),
};

function createNotes(doc: Y.Doc, count: number): string[] {
  const ids: string[] = [];
  for (let index = 0; index < count; index += 1) {
    const result = executeBoardCommand(
      doc,
      BOARD,
      {
        kind: 'createElement',
        type: 'note',
        placement: { x: index * 300, y: 0, width: 240, height: 80 },
        data: { text: `Узел ${String(index)}` },
      },
      environment,
    );
    if (!result.ok || result.value.createdId === undefined) throw new Error('нет элемента');
    ids.push(result.value.createdId);
  }
  return ids;
}

const record = (doc: Y.Doc, id: string): RecordMap => {
  const value = doc.getMap<unknown>('elements').get(id);
  if (!(value instanceof Y.Map)) throw new Error(`нет записи ${id}`);
  return value as RecordMap; // записи элементов — Y.Map
};

const setTree = (doc: Y.Doc, id: string, tree: MindMapLink): void => {
  updateRecord(record(doc, id), { tree });
};

const link = (parentId: string | null, order = 0): MindMapLink => ({
  parentId: parentId as ElementId | null, // тестовые id в допустимом формате
  order,
  collapsed: false,
  offset: null,
});

function exchange(a: Y.Doc, b: Y.Doc): void {
  Y.applyUpdate(a, Y.encodeStateAsUpdate(b));
  Y.applyUpdate(b, Y.encodeStateAsUpdate(a));
}

const forestOf = (doc: Y.Doc) => buildMindMapForest(readElements(doc).items);

describe('майнд-карта на двух устройствах', () => {
  it('встречное перецепление даёт одинаковое дерево без цикла на обоих устройствах', () => {
    const pc = new Y.Doc();
    const [root, a, b] = createNotes(pc, 3);
    if (root === undefined || a === undefined || b === undefined) throw new Error('мало узлов');
    setTree(pc, root, { ...link(null), direction: 'right' });
    setTree(pc, a, link(root, 0));
    setTree(pc, b, link(root, 1));
    const phone = new Y.Doc();
    exchange(pc, phone);

    updateRecord(record(pc, a), { tree: { parentId: b } });
    updateRecord(record(phone, b), { tree: { parentId: a } });
    exchange(pc, phone);

    const onPc = forestOf(pc);
    const onPhone = forestOf(phone);
    expect(onPc.roots).toEqual(onPhone.roots);
    expect([...onPc.nodes.values()]).toEqual(expect.arrayContaining([...onPhone.nodes.values()]));
    expect(onPc.nodes.size).toBe(3);
    const cycleRoot = [a, b].sort()[0];
    expect(onPc.repairs).toEqual([{ id: cycleRoot, kind: 'cycle' }]);
  });

  it('ветка добавлена на телефоне, родитель удалён на ПК — ветка цепляется к корню', () => {
    const pc = new Y.Doc();
    const [root, middle, leaf] = createNotes(pc, 3);
    if (root === undefined || middle === undefined || leaf === undefined)
      throw new Error('мало узлов');
    setTree(pc, root, link(null));
    setTree(pc, middle, link(root));
    const phone = new Y.Doc();
    exchange(pc, phone);

    updateRecord(record(pc, middle), { deletedAt: 200 });
    setTree(phone, leaf, link(middle));
    exchange(pc, phone);

    expect(forestOf(pc).nodes.get(leaf)?.parentId).toBe(root);
    expect(forestOf(phone).nodes.get(leaf)?.parentId).toBe(root);
  });

  it('битое поле tree не прячет карточку: она остаётся обычной', () => {
    const doc = new Y.Doc();
    const [id] = createNotes(doc, 1);
    if (id === undefined) throw new Error('нет узла');
    updateRecord(record(doc, id), { tree: { parentId: 42, order: 'первый' } });
    const elements = readElements(doc);
    expect(elements.invalid).toEqual([]);
    expect(elements.items[0]?.tree).toBeUndefined();
    expect(buildMindMapForest(elements.items).nodes.size).toBe(0);
  });
});
