import type { Theme } from '../core';

/** Тема интерфейса: «как в системе» убирает атрибут, и работает prefers-color-scheme (tokens.css). */
export function applyTheme(theme: Theme, root: HTMLElement = document.documentElement): void {
  if (theme === 'system') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', theme);
}
