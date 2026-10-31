import { z } from 'zod';

/**
 * Палитра цветов карточек, досок и тегов. Храним имя, а не цвет:
 * конкретный оттенок для светлой и тёмной темы задают токены `--color-card-<имя>`.
 */
export const COLOR_NAMES = [
  'default',
  'yellow',
  'orange',
  'red',
  'pink',
  'purple',
  'blue',
  'teal',
  'green',
  'gray',
] as const;

export const ColorNameSchema = z.enum(COLOR_NAMES);
export type ColorName = z.infer<typeof ColorNameSchema>;
