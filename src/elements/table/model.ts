import { z } from 'zod';

/**
 * Таблица (ТЗ, раздел 5). Столбцы и строки — объекты по id (в Yjs — вложенные карты):
 * правки разных ячеек, новые строки и столбцы с разных устройств сливаются.
 * Удалённое помечается removed, чтобы удаление не спорило с одновременной правкой.
 */
export const CELL_KINDS = ['text', 'number', 'checkbox', 'select'] as const;
export type CellKind = (typeof CELL_KINDS)[number];

const OptionSchema = z.object({
  name: z.string().max(100),
  order: z.number(),
  removed: z.boolean().optional(),
});

const ColumnSchema = z.object({
  name: z.string().max(200),
  kind: z.enum(CELL_KINDS),
  order: z.number(),
  options: z.record(z.string(), OptionSchema).optional(),
  removed: z.boolean().optional(),
});

const CellSchema = z.union([z.string().max(10_000), z.number(), z.boolean(), z.null()]);
export type Cell = z.infer<typeof CellSchema>;

const RowSchema = z.object({
  order: z.number(),
  removed: z.boolean().optional(),
  cells: z.record(z.string(), CellSchema),
});

export const TableDataSchema = z.object({
  columns: z.record(z.string(), ColumnSchema),
  rows: z.record(z.string(), RowSchema),
  sort: z.object({ column: z.string(), descending: z.boolean() }).nullable().optional(),
});
export type TableData = z.infer<typeof TableDataSchema>;
export type Column = z.infer<typeof ColumnSchema> & { readonly id: string };
export type Row = z.infer<typeof RowSchema> & { readonly id: string };
export type Option = z.infer<typeof OptionSchema> & { readonly id: string };

const byOrder = <T extends { readonly order: number; readonly id: string }>(a: T, b: T) =>
  a.order - b.order || (a.id < b.id ? -1 : 1);

export function columnsOf(data: TableData): Column[] {
  return Object.entries(data.columns)
    .filter(([, column]) => column.removed !== true)
    .map(([id, column]) => ({ ...column, id }))
    .sort(byOrder);
}

export function optionsOf(column: Column): Option[] {
  return Object.entries(column.options ?? {})
    .filter(([, option]) => option.removed !== true)
    .map(([id, option]) => ({ ...option, id }))
    .sort(byOrder);
}

/** Число из ячейки: число как есть, текст «1 234,5» — тоже число; иначе null. */
export function cellNumber(cell: Cell | undefined): number | null {
  if (typeof cell === 'number') return Number.isFinite(cell) ? cell : null;
  if (typeof cell !== 'string') return null;
  const normalized = cell.replace(/[\s\u00a0]/g, '').replace(',', '.');
  if (!/^-?\d+(\.\d+)?$/.test(normalized)) return null;
  return Number(normalized);
}

/** Текст ячейки для показа, сортировки и копирования. */
export function cellText(column: Column, cell: Cell | undefined): string {
  if (cell === undefined || cell === null) return '';
  if (column.kind === 'checkbox') return cell === true ? '✓' : '';
  if (column.kind === 'select')
    return optionsOf(column).find((option) => option.id === cell)?.name ?? '';
  return String(cell);
}

function compareCells(column: Column, a: Cell | undefined, b: Cell | undefined): number {
  if (column.kind === 'number' || column.kind === 'checkbox') {
    const value = (cell: Cell | undefined) =>
      column.kind === 'checkbox' ? (cell === true ? 1 : 0) : cellNumber(cell);
    const [x, y] = [value(a), value(b)];
    if (x === null || y === null) return x === y ? 0 : x === null ? 1 : -1;
    return x - y;
  }
  const [x, y] = [cellText(column, a), cellText(column, b)];
  if (x === '' || y === '') return x === y ? 0 : x === '' ? 1 : -1;
  return x.localeCompare(y, undefined, { numeric: true });
}

/** Строки по порядку или по сортировке столбца; пустые ячейки — в конце. */
export function rowsOf(data: TableData): Row[] {
  const rows = Object.entries(data.rows)
    .filter(([, row]) => row.removed !== true)
    .map(([id, row]) => ({ ...row, id }))
    .sort(byOrder);
  const sort = data.sort ?? null;
  const column =
    sort === null ? undefined : columnsOf(data).find((item) => item.id === sort.column);
  if (sort === null || column === undefined) return rows;
  const sign = sort.descending ? -1 : 1;
  return rows.sort((a, b) => {
    const [x, y] = [a.cells[column.id], b.cells[column.id]];
    const empty = (cell: Cell | undefined) => cellText(column, cell) === '';
    if (empty(x) || empty(y)) return compareCells(column, x, y);
    return sign * compareCells(column, x, y) || byOrder(a, b);
  });
}

/** Сумма числового столбца; null — столбец не числовой. */
export function columnSum(data: TableData, column: Column): number | null {
  if (column.kind !== 'number') return null;
  return rowsOf(data).reduce((sum, row) => sum + (cellNumber(row.cells[column.id]) ?? 0), 0);
}

/** Таблица текстом с табуляциями: вставляется в Excel и другие таблицы. */
export function tableToText(data: TableData): string {
  const columns = columnsOf(data);
  const lines = [
    columns.map((column) => column.name),
    ...rowsOf(data).map((row) => columns.map((column) => cellText(column, row.cells[column.id]))),
  ];
  return lines.map((cells) => cells.join('\t')).join('\n');
}
