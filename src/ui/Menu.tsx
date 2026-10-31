import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react';
import { cx } from './cx';
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
export function Menu({ entries, position, onClose }: MenuProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [placed, setPlaced] = useState(position);

  useLayoutEffect(() => {
    const menu = ref.current;
    if (menu === null) return;
    const { width, height } = menu.getBoundingClientRect();
    setPlaced({
      x: Math.max(EDGE, Math.min(position.x, window.innerWidth - width - EDGE)),
      y: Math.max(EDGE, Math.min(position.y, window.innerHeight - height - EDGE)),
    });
    menu.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus();
  }, [position]);

  useEffect(() => {
    const onPointerDown = (event: PointerEvent): void => {
      if (!(event.target instanceof Node) || ref.current?.contains(event.target) !== true)
        onClose();
    };
    window.addEventListener('pointerdown', onPointerDown, { capture: true });
    window.addEventListener('blur', onClose);
    window.addEventListener('resize', onClose);
    return () => {
      window.removeEventListener('pointerdown', onPointerDown, { capture: true });
      window.removeEventListener('blur', onClose);
      window.removeEventListener('resize', onClose);
    };
  }, [onClose]);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    const menu = ref.current;
    if (event.key === 'Escape') onClose();
    else if (menu !== null && event.key === 'ArrowDown') focusSibling(menu, 1);
    else if (menu !== null && event.key === 'ArrowUp') focusSibling(menu, -1);
    else return;
    event.preventDefault();
    event.stopPropagation();
  };

  return (
    <div
      ref={ref}
      role="menu"
      className={styles.menu}
      style={{ left: placed.x, top: placed.y }}
      onKeyDown={onKeyDown}
    >
      {entries.map((entry) => {
        if (entry.kind === 'separator') return <hr key={entry.id} className={styles.separator} />;
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
  );
}
