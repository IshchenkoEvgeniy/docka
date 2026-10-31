import type { Cell, CellKind, TableData } from './model';
import { cellNumber } from './model';

const MAX_ROWS = 500;
const MAX_COLUMNS = 50;

/** Разбор текста из Excel и Google Таблиц: строки — переводы строк, ячейки — табуляции. */
function splitTsv(text: string): string[][] {
  return text
    .replace(/\r\n?/g, '\n')
    .replace(/\n+$/, '')
    .split('\n')
    .map((line) => line.split('\t'));
}

/**
 * Таблица из вставленного текста; null — это не таблица (нет табуляций).
 * Первая строка — названия столбцов; столбец, где все значения — числа, становится числовым.
 */
export function tableFromText(text: string, newId: () => string): TableData | null {
  if (!text.includes('\t')) return null;
  const lines = splitTsv(text).slice(0, MAX_ROWS + 1);
  const width = Math.min(MAX_COLUMNS, Math.max(...lines.map((line) => line.length)));
  if (lines.length < 1 || width < 2) return null;
  const [header = [], ...body] = lines;
  const columnIds = Array.from({ length: width }, () => newId());
  const numeric = columnIds.map((_, index) => {
    const values = body.map((line) => line[index]?.trim() ?? '').filter((value) => value !== '');
    return values.length > 0 && values.every((value) => cellNumber(value) !== null);
  });
  const columns: TableData['columns'] = Object.fromEntries(
    columnIds.map((id, index) => {
      const kind: CellKind = numeric[index] === true ? 'number' : 'text';
      return [id, { name: header[index]?.trim() ?? '', kind, order: index + 1 }];
    }),
  );
  const rows = Object.fromEntries(
    body.map((line, rowIndex) => [
      newId(),
      {
        order: rowIndex + 1,
        cells: Object.fromEntries(
          columnIds.map((id, index): [string, Cell] => {
            const raw = line[index]?.trim() ?? '';
            return [id, numeric[index] === true && raw !== '' ? cellNumber(raw) : raw];
          }),
        ),
      },
    ]),
  );
  return { columns, rows, sort: null };
}
