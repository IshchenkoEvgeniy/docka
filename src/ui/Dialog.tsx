import { useEffect, useRef, type ReactNode } from 'react';
import { Button } from './Button';
import styles from './Dialog.module.css';
import { keepDialogFocus } from './dialogFocus';

interface DialogProps {
  readonly title: string;
  /** Подпись кнопки закрытия (ui не знает о переводах — текст передаёт вызывающий). */
  readonly closeLabel: string;
  readonly onClose: () => void;
  readonly children: ReactNode;
}

/** Модальное окно поверх приложения; закрывается по Esc, кнопке и клику по фону. */
export function Dialog({ title, closeLabel, onClose, children }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const previousFocus = useRef(document.activeElement);
  useEffect(() => {
    const dialog = ref.current;
    const previous = previousFocus.current;
    dialog?.showModal();
    return () => {
      dialog?.close();
      if (previous instanceof HTMLElement && previous.isConnected) previous.focus();
    };
  }, []);

  return (
    <dialog
      ref={ref}
      className={styles.modal}
      aria-label={title}
      onKeyDown={keepDialogFocus}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      <div
        className={styles.backdrop}
        onPointerDown={(event) => {
          if (event.target === event.currentTarget) onClose();
        }}
      >
        <div className={styles.dialog}>
          <header className={styles.header}>
            <h2 className={styles.title}>{title}</h2>
            <Button variant="ghost" onClick={onClose} autoFocus>
              {closeLabel}
            </Button>
          </header>
          <div className={styles.body}>{children}</div>
        </div>
      </div>
    </dialog>
  );
}
