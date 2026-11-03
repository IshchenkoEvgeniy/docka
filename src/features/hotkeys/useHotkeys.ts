import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { isEditableTarget, isModalOpen } from '../../ui';
import { isMacPlatform } from './combo';
import { findHotkey, parseHotkeys, type HotkeyDefinition } from './registry';

/** Обработчик может вернуть false: «не моё» — тогда браузер делает своё (Tab двигает фокус). */
export type HotkeyHandlers = Readonly<Partial<Record<string, () => unknown>>>;

/**
 * Один обработчик клавиатуры на окно. Пока фокус в поле ввода, горячие клавиши не мешают печатать.
 * enabled = false — например, пока открыто модальное окно.
 */
export function useHotkeys(
  definitions: readonly HotkeyDefinition[],
  handlers: HotkeyHandlers,
  enabled = true,
): void {
  const parsed = useMemo(() => parseHotkeys(definitions), [definitions]);
  const handlersRef = useRef(handlers);
  useLayoutEffect(() => {
    handlersRef.current = handlers;
  });
  useEffect(() => {
    if (!enabled) return undefined;
    const isMac = isMacPlatform();
    const onKeyDown = (event: KeyboardEvent): void => {
      if (isEditableTarget(event.target) || isModalOpen()) return;
      const id = findHotkey(parsed, event, isMac);
      const handler = id === null ? undefined : handlersRef.current[id];
      if (handler === undefined || handler() === false) return;
      event.preventDefault();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [parsed, enabled]);
}
