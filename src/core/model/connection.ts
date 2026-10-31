import { z } from 'zod';
import { ColorNameSchema } from './color';
import { BoardIdSchema, ConnectionIdSchema, ElementIdSchema, TimestampSchema } from './ids';

export const ANCHOR_SIDES = ['auto', 'top', 'right', 'bottom', 'left'] as const;

/** Конец стрелки: привязан к элементу или свободно висит в точке доски. */
export const EndpointSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('element'), elementId: ElementIdSchema, side: z.enum(ANCHOR_SIDES) }),
  z.object({ kind: z.literal('point'), x: z.number(), y: z.number() }),
]);
export type Endpoint = z.infer<typeof EndpointSchema>;

export const LINE_STYLES = ['straight', 'curved', 'elbow'] as const;
export const MARKERS = ['none', 'arrow', 'dot'] as const;

export const ConnectionSchema = z.object({
  id: ConnectionIdSchema,
  boardId: BoardIdSchema,
  from: EndpointSchema,
  to: EndpointSchema,
  label: z.string().max(500),
  color: ColorNameSchema,
  lineStyle: z.enum(LINE_STYLES),
  startMarker: z.enum(MARKERS),
  endMarker: z.enum(MARKERS),
  /** Момент удаления в корзину; null — стрелка на доске. */
  deletedAt: TimestampSchema.nullable(),
});
export type Connection = z.infer<typeof ConnectionSchema>;
