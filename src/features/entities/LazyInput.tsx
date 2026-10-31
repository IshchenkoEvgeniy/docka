import { useState, type InputHTMLAttributes } from 'react';
import styles from './Entities.module.css';

interface LazyInputProps extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'value' | 'onChange' | 'onBlur'
> {
  readonly value: string;
  /** Вызывается при уходе из поля или Enter, если текст изменился. */
  readonly onCommit: (value: string) => void;
}

/** Поле ввода, которое пишет в документ один раз, а не на каждую букву (один шаг отмены). */
export function LazyInput({ value, onCommit, className, ...rest }: LazyInputProps) {
  const [text, setText] = useState(value);
  return (
    <input
      {...rest}
      className={className ?? styles.input}
      value={text}
      onChange={(event) => {
        setText(event.target.value);
      }}
      onBlur={() => {
        if (text !== value) onCommit(text);
      }}
      onKeyDown={(event) => {
        if (event.key === 'Enter') event.currentTarget.blur();
      }}
    />
  );
}
