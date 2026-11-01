import type { KeyboardEvent } from 'react';

/** Явный цикл Tab не даёт фокусу уходить из модального содержимого в оболочку WebView. */
export function keepDialogFocus(event: KeyboardEvent<HTMLDialogElement>): void {
  if (event.key !== 'Tab') return;
  if (event.target instanceof Element && event.target.closest('dialog') !== event.currentTarget)
    return;
  const selector = 'button, [href], input, select, textarea, [tabindex]';
  const nodes = [...event.currentTarget.querySelectorAll<HTMLElement>(selector)].filter(
    (node) =>
      node.tabIndex >= 0 &&
      !node.matches(':disabled') &&
      node.closest('[inert]') === null &&
      node.getClientRects().length > 0,
  );
  const first = nodes.at(0);
  const last = nodes.at(-1);
  const active = document.activeElement;
  if (first === undefined || last === undefined) {
    event.preventDefault();
    return;
  }
  if (event.shiftKey && active === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && active === last) {
    event.preventDefault();
    first.focus();
  }
}
