import type { ColorName } from '../core';

/** Имя CSS-переменной фона карточки для цвета элемента (токены в tokens.css). */
export function cardColorToken(color: ColorName): string {
  return `--color-card-${color}`;
}

/** Значение для style: var(--color-card-…). */
export function cardColor(color: ColorName): string {
  return `var(${cardColorToken(color)})`;
}

/** Цвет линий и текста того же оттенка (стрелки): насыщеннее фона карточек. */
export function inkColor(color: ColorName): string {
  return `var(--color-ink-${color})`;
}
