import { CONTROL_ATTRIBUTE } from '../../canvas';
import { formatNumber, t } from '../../i18n';
import { defineElement } from '../defineElement';
import { newLocalId } from '../localId';
import { useElementRuntime } from '../runtime';
import { useMeasuredHeight } from '../text';
import type { ElementViewProps } from '../types';
import { CellInput } from './Cells';
import { HeaderCell } from './HeaderCell';
import {
  TableDataSchema,
  columnSum,
  columnsOf,
  rowsOf,
  tableToText,
  type Cell,
  type TableData,
} from './model';
import { tableFromText } from './paste';
import styles from './Table.module.css';

const control = { [CONTROL_ATTRIBUTE]: '' };
const ROW_HEIGHT = 34;
const COLUMN_WIDTH = 140;

function nextOrder(items: readonly { readonly order: number }[]): number {
  return Math.max(0, ...items.map((item) => item.order)) + 1;
}

function emptyTable(): TableData {
  const [a, b] = [newLocalId(), newLocalId()];
  return {
    columns: {
      [a]: { name: '', kind: 'text', order: 1 },
      [b]: { name: '', kind: 'text', order: 2 },
    },
    rows: { [newLocalId()]: { order: 1, cells: {} }, [newLocalId()]: { order: 2, cells: {} } },
    sort: null,
  };
}

function Sums({ data }: { readonly data: TableData }) {
  const columns = columnsOf(data);
  const sums = columns.map((column) => columnSum(data, column));
  if (sums.every((sum) => sum === null)) return null;
  return (
    <tfoot>
      <tr>
        {sums.map((sum, index) => (
          <td key={columns[index]?.id ?? index} className={styles.sum}>
            {sum === null ? '' : `Σ ${formatNumber(sum)}`}
          </td>
        ))}
      </tr>
    </tfoot>
  );
}

function TableView({ element, data, editing }: ElementViewProps<TableData>) {
  const runtime = useElementRuntime();
  const ref = useMeasuredHeight(element.id);
  const update = (changes: Readonly<Record<string, unknown>>): void => {
    runtime.updateData(element.id, changes);
  };
  const columns = columnsOf(data);
  const rows = rowsOf(data);
  const setCell = (rowId: string, columnId: string) => (value: Cell) => {
    update({ rows: { [rowId]: { cells: { [columnId]: value } } } });
  };
  const addRow = (): void => {
    update({ rows: { [newLocalId()]: { order: nextOrder(Object.values(data.rows)), cells: {} } } });
  };
  const addColumn = (): void => {
    const order = nextOrder(Object.values(data.columns));
    update({ columns: { [newLocalId()]: { name: '', kind: 'text', order } } });
  };
  return (
    <div ref={ref} className={styles.table}>
      <div className={styles.bar}>
        <span>{t('elements.table.title', { rows: rows.length, columns: columns.length })}</span>
      </div>
      <div className={styles.scroll}>
        <table className={styles.grid}>
          <thead>
            <tr>
              {columns.map((column) => (
                <HeaderCell
                  key={column.id}
                  column={column}
                  data={data}
                  editing={editing}
                  update={update}
                />
              ))}
              {editing && <th />}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                {columns.map((column) => (
                  <td key={column.id}>
                    <CellInput
                      column={column}
                      cell={row.cells[column.id]}
                      label={column.name === '' ? t('elements.table.untitled') : column.name}
                      onChange={setCell(row.id, column.id)}
                    />
                  </td>
                ))}
                {editing && (
                  <td>
                    <button
                      {...control}
                      type="button"
                      className={styles.remove}
                      aria-label={t('elements.table.removeRow')}
                      onClick={() => {
                        update({ rows: { [row.id]: { removed: true } } });
                      }}
                    >
                      {t('elements.table.removeIcon')}
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
          <Sums data={data} />
        </table>
      </div>
      <div className={styles.actions}>
        <button {...control} type="button" className={styles.add} onClick={addRow}>
          {t('elements.table.addRow')}
        </button>
        {editing && (
          <button {...control} type="button" className={styles.add} onClick={addColumn}>
            {t('elements.table.addColumn')}
          </button>
        )}
      </div>
    </div>
  );
}

export const table = defineElement<TableData>({
  type: 'table',
  label: () => t('elementTypes.table'),
  dataSchema: TableDataSchema,
  defaultSize: { width: 2 * COLUMN_WIDTH + 24, height: 4 * ROW_HEIGHT },
  minSize: { width: 160, height: 80 },
  resize: 'width',
  richText: false,
  // Двойной щелчок — правка столбцов (название, вид, варианты); ячейки правятся всегда.
  activate: 'edit',
  editOnCreate: false,
  createData: emptyTable,
  View: TableView,
  toPlainText: tableToText,
  fromPastedText: (text) => {
    const data = tableFromText(text, newLocalId);
    if (data === null) return null;
    const columns = Object.keys(data.columns).length;
    const rows = Object.keys(data.rows).length;
    return {
      data,
      width: Math.min(900, columns * COLUMN_WIDTH + 24),
      height: (rows + 3) * ROW_HEIGHT,
    };
  },
});
