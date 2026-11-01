import { useLayoutEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import { cx } from './cx';
import { Button } from './Button';
import { keepDialogFocus } from './dialogFocus';
import { menuViewport } from './menuViewport';
import styles from './Menu.module.css';

export interface MenuAction {
  readonly kind: 'action';
  readonly id: string;
  readonly label: string;
  /** Подсказка справа, например сочетание клавиш. */
  readonly hint?: string;
  readonly disabled?: boolean;
  readonly danger?: boolean;
  readonly onSelect: () => void;
}

export type MenuEntry =
  | MenuAction
  | { readonly kind: 'separator'; readonly id: string }
  | { readonly kind: 'heading'; readonly id: string; readonly label: string };

interface MenuProps {
  readonly title: string;
  readonly closeLabel: string;
  readonly entries: readonly MenuEntry[];
  /** Точка в координатах окна (clientX/clientY). */
  readonly position: { readonly x: number; readonly y: number };
  readonly onClose: () => void;
}

const EDGE = 8;

function focusSibling(menu: HTMLElement, step: 1 | -1): void {
  const items = [...menu.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')];
  const index = items.findIndex((item) => item === document.activeElement);
  const next = items[(index + step + items.length) % items.length];
  next?.focus();
}

/** Контекстное меню: не выходит за край окна, закрывается по Esc, клику мимо и выбору пункта. */
export function Menu({ entries, position, onClose, title, closeLabel }: MenuProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const ref = useRef<HTMLDivElement>(null);
  const surfaceRef = useRef<HTMLDivElement>(null);
  const previousFocus = useRef(document.activeElement);
  const pointerStartedInside = useRef(false);
  const [viewport, setViewport] = useState(menuViewport);
  const [placed, setPlaced] = useState(position);

  useLayoutEffect(() => {
    const dialog = dialogRef.current;
    const previous = previousFocus.current;
    dialog?.showModal();
    const place = (): void => {
      const bounds = menuViewport();
      setViewport(bounds);
      const { width, height } = surfaceRef.current?.getBoundingClientRect() ?? {
        width: 0,
        height: 0,
      };
      setPlaced({
        x: Math.max(EDGE, Math.min(position.x - bounds.left, bounds.width - width - EDGE)),
        y: Math.max(EDGE, Math.min(position.y - bounds.top, bounds.height - height - EDGE)),
      });
    };
    place();
    ref.current
      ?.querySelector<HTMLButtonElement>('button:not(:disabled)')
      ?.focus({ preventScroll: true });
    window.addEventListener('resize', place);
    window.visualViewport?.addEventListener('resize', place);
    window.visualViewport?.addEventListener('scroll', place);
    return () => {
      window.removeEventListener('resize', place);
      window.visualViewport?.removeEventListener('resize', place);
      window.visualViewport?.removeEventListener('scroll', place);
      dialog?.close();
      if (previous instanceof HTMLElement && previous.isConnected)
        previous.focus({ preventScroll: true });
    };
  }, [position]);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    const menu = ref.current;
    if (event.key === 'Escape') onClose();
    else if (menu !== null && event.key === 'ArrowDown') focusSibling(menu, 1);
    else if (menu !== null && event.key === 'ArrowUp') focusSibling(menu, -1);
    else return;
    event.preventDefault();
    event.stopPropagation();
  };

  const placement = {
    '--menu-x': `${String(placed.x)}px`,
    '--menu-y': `${String(placed.y)}px`,
  } as CSSProperties; // CSS-переменные задают только координаты меню
  return createPortal(
    <dialog
      ref={dialogRef}
      className={styles.modal}
      aria-label={title}
      style={viewport}
      onKeyDown={keepDialogFocus}
      onPointerDownCapture={() => {
        pointerStartedInside.current = true;
      }}
      onClickCapture={(event) => {
        // Отпускание долгого нажатия, открывшего меню под пальцем, не выбирает его пункт.
        if (event.detail > 0 && !pointerStartedInside.current) {
          event.preventDefault();
          event.stopPropagation();
        }
      }}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) {
          event.preventDefault();
          onClose();
        }
      }}
    >
      <div ref={surfaceRef} className={styles.surface} style={placement}>
        <header className={styles.header}>
          <h2>{title}</h2>
          <Button variant="ghost" onClick={onClose}>
            {closeLabel}
          </Button>
        </header>
        <div ref={ref} role="menu" aria-label={title} className={styles.menu} onKeyDown={onKeyDown}>
          {entries.map((entry) => {
            if (entry.kind === 'separator')
              return <hr key={entry.id} className={styles.separator} />;
            if (entry.kind === 'heading')
              return (
                <div key={entry.id} className={styles.heading}>
                  {entry.label}
                </div>
              );
            return (
              <button
                key={entry.id}
                type="button"
                role="menuitem"
                disabled={entry.disabled}
                className={cx(styles.item, entry.danger === true && styles.danger)}
                onClick={() => {
                  onClose();
                  entry.onSelect();
                }}
              >
                <span>{entry.label}</span>
                {entry.hint !== undefined && <span className={styles.hint}>{entry.hint}</span>}
              </button>
            );
          })}
        </div>
      </div>
    </dialog>,
    document.body,
  );
}
