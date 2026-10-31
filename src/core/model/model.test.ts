import { describe, expect, it } from 'vitest';
import {
  BoardSchema,
  ConnectionSchema,
  ElementSchema,
  ProjectMetaSchema,
  TagSchema,
  boardPath,
  compareStacking,
  normalizeTagName,
  tagWithAncestors,
  validate,
  wouldCreateCycle,
  type BoardId,
} from '.';

const board = {
  id: 'board-root',
  title: 'Игра',
  parentId: null,
  icon: null,
  color: 'default',
  background: 'dots',
  createdAt: 1,
  updatedAt: 2,
  deletedAt: null,
};

const element = {
  id: 'element-1',
  boardId: 'board-root',
  type: 'note',
  x: 10,
  y: -20.5,
  width: 240,
  height: 120,
  z: 3,
  parentId: null,
  color: 'yellow',
  locked: false,
  tagIds: ['tag-npc-01'],
  createdAt: 1,
  updatedAt: 1,
  deletedAt: null,
  data: { text: 'Трактирщик' },
};

describe('схемы', () => {
  it('принимают корректные данные', () => {
    expect(BoardSchema.safeParse(board).success).toBe(true);
    expect(ElementSchema.safeParse(element).success).toBe(true);
    expect(
      ProjectMetaSchema.safeParse({
        formatVersion: 1,
        id: 'project-1',
        name: 'Моя игра',
        rootBoardId: 'board-root',
        createdAt: 0,
      }).success,
    ).toBe(true);
  });

  it('отклоняют мусор из файлов с понятной ошибкой', () => {
    expect(validate(ElementSchema, { ...element, x: Number.NaN })).toEqual({
      ok: false,
      error: expect.stringContaining('x') as unknown,
    });
    expect(validate(ElementSchema, { ...element, width: 0 }).ok).toBe(false);
    expect(validate(ElementSchema, { ...element, type: 'Note!' }).ok).toBe(false);
    expect(validate(BoardSchema, { ...board, id: '../../etc' }).ok).toBe(false);
    expect(validate(BoardSchema, { ...board, color: 'neon' }).ok).toBe(false);
  });

  it('проверяют концы стрелок', () => {
    const connection = {
      id: 'connection-1',
      boardId: 'board-root',
      from: { kind: 'element', elementId: 'element-1', side: 'auto' },
      to: { kind: 'point', x: 100, y: 50 },
      label: '',
      color: 'default',
      lineStyle: 'curved',
      startMarker: 'none',
      endMarker: 'arrow',
      deletedAt: null,
    };
    expect(ConnectionSchema.safeParse(connection).success).toBe(true);
    expect(ConnectionSchema.safeParse({ ...connection, to: { kind: 'element' } }).success).toBe(
      false,
    );
  });

  it('нормализуют имя тега при проверке', () => {
    const parsed = validate(TagSchema, {
      id: 'tag-bug-01',
      name: '  баг / критичный ',
      color: 'red',
    });
    expect(parsed).toEqual({
      ok: true,
      value: { id: 'tag-bug-01', name: 'баг/критичный', color: 'red' },
    });
    expect(validate(TagSchema, { id: 'tag-empty-1', name: ' / ', color: 'red' }).ok).toBe(false);
  });
});

describe('теги', () => {
  it('нормализация убирает лишние пробелы и пустые сегменты', () => {
    expect(normalizeTagName('  мир //  локации   важные ')).toBe('мир/локации важные');
  });

  it('родители тега для фильтра', () => {
    expect(tagWithAncestors('мир/локации/город')).toEqual([
      'мир',
      'мир/локации',
      'мир/локации/город',
    ]);
  });
});

describe('дерево досок', () => {
  const id = (value: string) => value as BoardId; // в тестах id — заведомо корректные строки
  const parents = new Map<BoardId, BoardId | null>([
    [id('root'), null],
    [id('npc'), id('root')],
    [id('tavern'), id('npc')],
  ]);
  const parentOf = (board: BoardId) => parents.get(board);

  it('путь от корня для хлебных крошек', () => {
    expect(boardPath(id('tavern'), parentOf)).toEqual(['root', 'npc', 'tavern']);
  });

  it('нельзя положить доску внутрь самой себя или своей вложенной доски', () => {
    expect(wouldCreateCycle(id('npc'), id('tavern'), parentOf)).toBe(true);
    expect(wouldCreateCycle(id('npc'), id('npc'), parentOf)).toBe(true);
    expect(wouldCreateCycle(id('tavern'), id('root'), parentOf)).toBe(false);
  });

  it('повреждённое дерево с циклом не зацикливает программу', () => {
    const broken = new Map<BoardId, BoardId>([
      [id('a'), id('b')],
      [id('b'), id('a')],
    ]);
    expect(boardPath(id('a'), (board) => broken.get(board))).toEqual(['b', 'a']);
  });
});

describe('порядок наложения', () => {
  it('по z, при равенстве — по id, одинаково на всех устройствах', () => {
    const items = [
      { z: 2, id: 'b' },
      { z: 1, id: 'z' },
      { z: 2, id: 'a' },
    ];
    expect([...items].sort(compareStacking).map((item) => item.id)).toEqual(['z', 'a', 'b']);
  });
});
