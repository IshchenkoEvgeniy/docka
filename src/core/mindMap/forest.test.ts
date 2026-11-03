import { describe, expect, it } from 'vitest';
import type { ElementId, MindMapLink } from '../model';
import { buildMindMapForest, type MindMapInput } from './forest';

const link = (parentId: string | null, order = 0): MindMapLink => ({
  parentId: parentId as ElementId | null, // тестовые id в допустимом формате
  order,
  collapsed: false,
  offset: null,
});

const node = (id: string, parentId: string | null, order = 0, deletedAt: number | null = null) =>
  ({ id, deletedAt, tree: link(parentId, order) }) satisfies MindMapInput;

const parentsOf = (inputs: MindMapInput[]) =>
  Object.fromEntries([...buildMindMapForest(inputs).nodes.values()].map((n) => [n.id, n.parentId]));

describe('майнд-карты доски', () => {
  it('собирает дерево: дети по order, при равенстве по id; глубина и корень', () => {
    const forest = buildMindMapForest([
      node('root-000', null),
      node('child-bb', 'root-000', 1),
      node('child-aa', 'root-000', 1),
      node('child-cc', 'root-000', 0),
      node('grand-00', 'child-aa', 0),
      { id: 'plain-00', deletedAt: null },
    ]);
    expect(forest.roots).toEqual(['root-000']);
    expect(forest.nodes.get('root-000')?.children).toEqual(['child-cc', 'child-aa', 'child-bb']);
    expect(forest.nodes.get('grand-00')).toMatchObject({ depth: 2, rootId: 'root-000' });
    expect(forest.nodes.has('plain-00')).toBe(false);
    expect(forest.repairs).toEqual([]);
  });

  it('несколько карт на доске — корни по id', () => {
    const forest = buildMindMapForest([node('root-bbb', null), node('root-aaa', null)]);
    expect(forest.roots).toEqual(['root-aaa', 'root-bbb']);
  });

  it('удалённый родитель — узел цепляется к ближайшему живому предку', () => {
    const inputs = [
      node('root-000', null),
      node('middle-1', 'root-000', 0, 50),
      node('middle-2', 'middle-1', 0, 50),
      node('leaf-000', 'middle-2'),
    ];
    expect(parentsOf(inputs)).toEqual({ 'root-000': null, 'leaf-000': 'root-000' });
    expect(buildMindMapForest(inputs).repairs).toEqual([{ id: 'leaf-000', kind: 'missingParent' }]);
  });

  it('удалённый корень, неизвестный родитель, родитель не из карты — узел становится корнем', () => {
    const forest = buildMindMapForest([
      node('root-000', null, 0, 50),
      node('orphan-1', 'root-000'),
      node('orphan-2', 'missing-0'),
      { id: 'plain-00', deletedAt: null },
      node('orphan-3', 'plain-00'),
    ]);
    expect(forest.roots).toEqual(['orphan-1', 'orphan-2', 'orphan-3']);
    expect(forest.nodes.has('root-000')).toBe(false);
  });

  it('цепочка удалённых узлов с циклом не зацикливает чтение', () => {
    const forest = buildMindMapForest([
      node('dead-aaa', 'dead-bbb', 0, 50),
      node('dead-bbb', 'dead-aaa', 0, 50),
      node('leaf-000', 'dead-aaa'),
    ]);
    expect(forest.roots).toEqual(['leaf-000']);
  });

  it('цикл двух устройств: корнем становится узел с наименьшим id, ветки сохраняются', () => {
    const inputs = [
      node('node-bbb', 'node-aaa'),
      node('node-aaa', 'node-ccc'),
      node('node-ccc', 'node-bbb'),
      node('tail-000', 'node-ccc'),
    ];
    const forest = buildMindMapForest(inputs);
    expect(forest.roots).toEqual(['node-aaa']);
    expect(parentsOf(inputs)).toEqual({
      'node-aaa': null,
      'node-bbb': 'node-aaa',
      'node-ccc': 'node-bbb',
      'tail-000': 'node-ccc',
    });
    expect(forest.repairs).toEqual([{ id: 'node-aaa', kind: 'cycle' }]);
  });

  it('узел, ссылающийся сам на себя, — корень', () => {
    expect(buildMindMapForest([node('self-000', 'self-000')]).roots).toEqual(['self-000']);
  });

  it('результат не зависит от порядка элементов', () => {
    const inputs = [
      node('node-bbb', 'node-aaa', 2),
      node('node-aaa', 'node-bbb'),
      node('node-ccc', 'node-aaa', 1),
      node('node-ddd', 'gone-000'),
      node('gone-000', 'node-ccc', 0, 10),
    ];
    const expected = buildMindMapForest(inputs);
    for (const shuffled of [
      [...inputs].reverse(),
      [inputs[2], inputs[4], inputs[0], inputs[3], inputs[1]],
    ]) {
      const forest = buildMindMapForest(shuffled.filter((x) => x !== undefined));
      expect(forest.roots).toEqual(expected.roots);
      expect([...forest.nodes.values()].sort((a, b) => (a.id < b.id ? -1 : 1))).toEqual(
        [...expected.nodes.values()].sort((a, b) => (a.id < b.id ? -1 : 1)),
      );
    }
  });
});
