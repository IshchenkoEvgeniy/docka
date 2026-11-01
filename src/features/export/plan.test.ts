import { describe, expect, it } from 'vitest';
import { ElementSchema, ConnectionSchema, type BoardElement, type Connection } from '../../core';
import { createExportPlan, exportFileName, exportFits, type ExportSource } from './plan';

function element(
  id: string,
  changes: Partial<Omit<BoardElement, 'parentId'>> & { parentId?: string | null } = {},
): BoardElement {
  return ElementSchema.parse({
    id,
    boardId: 'board-0001',
    type: 'note',
    x: 0,
    y: 0,
    width: 200,
    height: 100,
    z: 0,
    parentId: null,
    color: 'default',
    locked: false,
    tags: {},
    data: {},
    createdAt: 1,
    updatedAt: 1,
    deletedAt: null,
    ...changes,
  });
}

function connection(id: string, from: string, to: string): Connection {
  return ConnectionSchema.parse({
    id,
    boardId: 'board-0001',
    from: { kind: 'element', elementId: from, side: 'auto' },
    to: { kind: 'element', elementId: to, side: 'auto' },
    label: '',
    color: 'default',
    lineStyle: 'straight',
    startMarker: 'none',
    endMarker: 'arrow',
    deletedAt: null,
  });
}

function source(
  elements: BoardElement[],
  selected: string[] = [],
  connections: Connection[] = [],
  lines: string[] = [],
): ExportSource {
  return {
    elements: new Map(elements.map((item) => [item.id, item])),
    selection: new Set(selected),
    connections: new Map(connections.map((item) => [item.id, item])),
    connectionSelection: new Set(lines),
  };
}

describe('план экспорта PNG', () => {
  it('выбранная рамка включает карточки, колонку с детьми и внутренние свободные стрелки', () => {
    const items = [
      element('frame-0001', { type: 'frame', width: 800, height: 600, z: 10 }),
      element('elem-0001', { x: 40, y: 80 }),
      element('col-0001', { type: 'column', x: 400, y: 80, width: 300, height: 400 }),
      element('child-0001', { parentId: 'col-0001', y: 16 }),
      element('other-0001', { x: 2000 }),
    ];
    const line = ConnectionSchema.parse({
      ...connection('line-0001', 'elem-0001', 'col-0001'),
      from: { kind: 'point', x: 30, y: 30 },
      to: { kind: 'point', x: 600, y: 500 },
    });
    const plan = createExportPlan(source(items, ['frame-0001'], [line]), 'selection');
    expect(plan?.elements.size).toBe(4);
    expect(plan?.roots.map((item) => item.id)).toEqual(['frame-0001', 'col-0001', 'elem-0001']);
    expect(plan?.connections).toHaveLength(1);
    expect(plan?.bounds.y).toBe(-68);
  });

  it('охватывает отрицательные координаты и карточки далеко за экраном', () => {
    const plan = createExportPlan(
      source([element('elem-0001', { x: -100, y: -50 }), element('elem-0002', { x: 2000 })]),
      'board',
    );
    expect(plan?.bounds).toEqual({ x: -124, y: -74, width: 2348, height: 198 });
    expect(plan?.roots).toHaveLength(2);
  });

  it('выбранная колонка включает детей и связи между ними, чужие карточки не включаются', () => {
    const items = [
      element('col-0001', { type: 'column' }),
      element('elem-0001', { parentId: 'col-0001' }),
      element('elem-0002', { parentId: 'col-0001' }),
      element('other-0001'),
    ];
    const lines = [
      connection('line-0001', 'elem-0001', 'elem-0002'),
      connection('line-0002', 'elem-0001', 'other-0001'),
    ];
    const plan = createExportPlan(source(items, ['col-0001'], lines), 'selection');
    expect([...(plan?.elements.keys() ?? [])]).toEqual(['col-0001', 'elem-0001', 'elem-0002']);
    expect(plan?.roots.map((item) => item.id)).toEqual(['col-0001']);
    expect(plan?.connections.map((item) => item.id)).toEqual(['line-0001']);
  });

  it('экспортирует только выбранного ребёнка в его измеренных координатах', () => {
    const input = source(
      [element('col-0001', { type: 'column' }), element('elem-0001', { parentId: 'col-0001' })],
      ['elem-0001'],
    );
    const plan = createExportPlan(
      { ...input, measure: () => ({ x: 40, y: 80, width: 180, height: 120 }) },
      'selection',
    );
    expect(plan?.roots).toHaveLength(1);
    expect(plan?.roots[0]).toMatchObject({
      id: 'elem-0001',
      x: 40,
      y: 80,
      width: 180,
      parentId: null,
    });
  });

  it('выбранная стрелка сохраняется без прикреплённых карточек', () => {
    const line = connection('line-0001', 'elem-0001', 'elem-0002');
    const plan = createExportPlan(
      source([element('elem-0001'), element('elem-0002', { x: 500 })], [], [line], [line.id]),
      'selection',
    );
    expect(plan?.roots).toHaveLength(0);
    expect(plan?.connections).toEqual([line]);
  });

  it('поддерживает доску только со свободной стрелкой', () => {
    const line = ConnectionSchema.parse({
      ...connection('line-0001', 'elem-0001', 'elem-0002'),
      from: { kind: 'point', x: -300, y: 0 },
      to: { kind: 'point', x: 200, y: 200 },
    });
    expect(createExportPlan(source([], [], [line]), 'board')?.bounds).toEqual({
      x: -324,
      y: -24,
      width: 548,
      height: 248,
    });
  });

  it('пустое выделение не подменяется всей доской', () => {
    expect(createExportPlan(source([element('elem-0001')]), 'selection')).toBeNull();
    expect(createExportPlan(source([]), 'board')).toBeNull();
  });

  it('сохраняет порядок слоёв', () => {
    const plan = createExportPlan(
      source([element('elem-0002', { z: 5 }), element('elem-0001', { z: -1 })]),
      'board',
    );
    expect(plan?.roots.map((item) => item.id)).toEqual(['elem-0001', 'elem-0002']);
  });

  it('отклоняет слишком большие bitmap и недопустимый масштаб', () => {
    expect(exportFits({ x: 0, y: 0, width: 2000, height: 1000 }, 3)).toBe(true);
    expect(exportFits({ x: 0, y: 0, width: 3000, height: 1000 }, 3)).toBe(false);
    expect(exportFits({ x: 0, y: 0, width: 8192, height: 8192 }, 1)).toBe(false);
    expect(exportFits({ x: 0, y: 0, width: Infinity, height: 100 }, 1)).toBe(false);
    expect(exportFits({ x: 0, y: 0, width: 100, height: 100 }, 4)).toBe(false);
  });

  it('убирает опасные символы из имени файла', () => {
    expect(exportFileName('../Мир: НПС?.')).toBe('.._Мир_ НПС_.png');
    expect(exportFileName('...')).toBe('Doska.png');
  });
});
