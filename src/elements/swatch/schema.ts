import { z } from 'zod';

/** Образец цвета: код и необязательное название («Основной синий»). */
export const SwatchDataSchema = z.object({
  hex: z.string().regex(/^#[0-9A-F]{6}$/),
  name: z.string().max(100).optional(),
});
export type SwatchData = z.infer<typeof SwatchDataSchema>;

export const DEFAULT_SWATCH = '#4A90D9';
