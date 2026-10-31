import { describe, expect, it } from 'vitest';
import { definitionFor, draftFromPastedText } from '../registry';
import { nextSort, optionChanges } from './HeaderCell';
import {
  TableDataSchema,
  columnSum,
  columnsOf,
  rowsOf,
  tableToText,
  type TableData,
} from './model';
import { tableFromText } from './paste';

function ids() {
  let next = 0;
  return () => `id-${String((next += 1)).padStart(4, '0')}`;
}

const EXCEL = 'Предмет\tЦена\tВес\r\nМеч\t1 200,5\t3\r\nЩит\t800\t\r\nЗелье\t50\tлёгкое\r\n';

describe('таблица', () => {
  it('из Excel: первая строка — названия, числовые столбцы узнаются', () => {
    const data = tableFromText(EXCEL, ids());
    if (data === null) throw new Error('не таблица');
    expect(TableDataSchema.safeParse(data).success).toBe(true);
    expect(columnsOf(data).map((column) => [column.name, column.kind])).toEqual([
      ['Предмет', 'text'],
      ['Цена', 'number'],
      ['Вес', 'text'],
    ]);
    const price = columnsOf(data)[1];
    if (price === undefined) throw new Error('нет столбца');
    expect(columnSum(data, price)).toBe(2050.5);
    expect(tableFromText('просто текст', ids())).toBeNull();
  });

  it('сортировка по столбцу, пустые — в конце; копия текстом с табуляциями', () => {
    const data = tableFromText(EXCEL, ids());
    if (data === null) throw new Error('не таблица');
    const [name, price] = columnsOf(data);
    if (name === undefined || price === undefined) throw new Error('нет столбцов');
    const sorted = (sort: TableData['sort']) =>
      rowsOf({ ...data, sort }).map((row) => row.cells[name.id]);
    expect(sorted({ column: price.id, descending: false })).toEqual(['Зелье', 'Щит', 'Меч']);
    expect(sorted({ column: price.id, descending: true })).toEqual(['Меч', 'Щит', 'Зелье']);
    expect(tableToText(data).split('\n')[1]).toBe('Меч\t1200.5\t3');
  });

  it('щелчок по заголовку: по возрастанию → по убыванию → без сортировки', () => {
    expect(nextSort(null, 'a')).toEqual({ column: 'a', descending: false });
    expect(nextSort({ column: 'a', descending: false }, 'a')).toEqual({
      column: 'a',
      descending: true,
    });
    expect(nextSort({ column: 'a', descending: true }, 'a')).toBeNull();
  });

  it('варианты списка правятся строкой через запятую', () => {
    const column = {
      id: 'col-00001',
      name: 'Статус',
      kind: 'select' as const,
      order: 1,
      options: {
        'opt-00001': { name: 'Готово', order: 1 },
        'opt-00002': { name: 'В работе', order: 2 },
      },
    };
    const changes = optionChanges(column, 'Готово, Идея');
    expect(changes['opt-00002']).toEqual({ removed: true });
    expect(Object.values(changes)).toContainEqual({ name: 'Идея', order: 3 });
  });

  it('реестр отдаёт вставленный текст с табуляциями таблице', () => {
    expect(draftFromPastedText(EXCEL)?.type).toBe('table');
    expect(draftFromPastedText('Таверна')).toBeNull();
    expect(definitionFor('table').createData()).toMatchObject({ sort: null });
  });
});
