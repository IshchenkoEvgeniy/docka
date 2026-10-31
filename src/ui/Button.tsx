import type { ButtonHTMLAttributes } from 'react';
import { cx } from './cx';
import styles from './Button.module.css';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  readonly variant?: 'default' | 'primary' | 'ghost';
  /** Кнопка-переключатель во включённом состоянии. */
  readonly pressed?: boolean;
}

export function Button({ variant = 'default', pressed, className, type, ...rest }: ButtonProps) {
  return (
    <button
      {...rest}
      type={type ?? 'button'}
      aria-pressed={pressed}
      className={cx(styles.button, styles[variant], pressed === true && styles.pressed, className)}
    />
  );
}
