import { useEffect, type ReactNode } from 'react';
import { Button } from './Button';
import styles from './Dialog.module.css';

interface DialogProps {
  readonly title: string;
  /** Подпись кнопки закрытия (ui не знает о переводах — текст передаёт вызывающий). */
  readonly closeLabel: string;
  readonly onClose: () => void;
  readonly children: ReactNode;
}

/** Модальное окно поверх приложения; закрывается по Esc, кнопке и клику по фону. */
export function Dialog({ title, closeLabel, onClose, children }: DialogProps) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [onClose]);

  return (
    <div
      className={styles.backdrop}
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div role="dialog" aria-modal="true" aria-label={title} className={styles.dialog}>
        <header className={styles.header}>
          <h2 className={styles.title}>{title}</h2>
          <Button variant="ghost" onClick={onClose} autoFocus>
            {closeLabel}
          </Button>
        </header>
        <div className={styles.body}>{children}</div>
      </div>
    </div>
  );
}
