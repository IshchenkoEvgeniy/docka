import { useId, type InputHTMLAttributes } from 'react';
import styles from './TextField.module.css';

interface TextFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'id'> {
  readonly label: string;
  readonly error?: string | null;
}

export function TextField({ label, error, ...rest }: TextFieldProps) {
  const id = useId();
  return (
    <div className={styles.field}>
      <label className={styles.label} htmlFor={id}>
        {label}
      </label>
      <input
        {...rest}
        id={id}
        className={styles.input}
        aria-invalid={error !== undefined && error !== null}
      />
      {error !== undefined && error !== null && <p className={styles.error}>{error}</p>}
    </div>
  );
}
