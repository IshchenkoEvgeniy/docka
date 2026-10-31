import { useState } from 'react';
import { CONTROL_ATTRIBUTE } from '../../canvas';
import { cellNumber, optionsOf, type Cell, type Column } from './model';
import styles from './Table.module.css';

const control = { [CONTROL_ATTRIBUTE]: '' };

interface CellProps {
  readonly column: Column;
  readonly cell: Cell | undefined;
  readonly label: string;
  /** Записать значение ячейки (одна правка — один шаг отмены). */
  readonly onChange: (value: Cell) => void;
}

/** Текст и число: запись при уходе из ячейки; Enter — дальше. */
function TextCell({ column, cell, label, onChange }: CellProps) {
  const initial = cell === undefined || cell === null ? '' : String(cell);
  const [text, setText] = useState(initial);
  const number = column.kind === 'number';
  const commit = (): void => {
    if (text === initial) return;
    if (text.trim() === '') onChange(null);
    else onChange(number ? (cellNumber(text) ?? text) : text);
  };
  return (
    <input
      {...control}
      className={number ? styles.numberInput : styles.input}
      inputMode={number ? 'decimal' : 'text'}
      aria-label={label}
      value={text}
      onChange={(event) => {
        setText(event.target.value);
      }}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === 'Escape') event.currentTarget.blur();
      }}
    />
  );
}

export function CellInput(props: CellProps) {
  const { column, cell, label, onChange } = props;
  if (column.kind === 'checkbox')
    return (
      <input
        {...control}
        type="checkbox"
        className={styles.check}
        aria-label={label}
        checked={cell === true}
        onChange={(event) => {
          onChange(event.target.checked);
        }}
      />
    );
  if (column.kind === 'select')
    return (
      <select
        {...control}
        className={styles.input}
        aria-label={label}
        value={typeof cell === 'string' ? cell : ''}
        onChange={(event) => {
          onChange(event.target.value === '' ? null : event.target.value);
        }}
      >
        <option value="" />
        {optionsOf(column).map((option) => (
          <option key={option.id} value={option.id}>
            {option.name}
          </option>
        ))}
      </select>
    );
  return <TextCell key={String(cell)} {...props} />;
}
