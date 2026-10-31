import { z } from 'zod';
import { BoardIdSchema, ProjectIdSchema, TimestampSchema } from './ids';

/** Текущая версия формата папки проекта (docs/format.md). */
export const FORMAT_VERSION = 2;

/** project.json в корне папки проекта: читается до открытия документов. */
export const ProjectMetaSchema = z.object({
  formatVersion: z.number().int().positive(),
  id: ProjectIdSchema,
  name: z.string().trim().min(1).max(200),
  rootBoardId: BoardIdSchema,
  createdAt: TimestampSchema,
});
export type ProjectMeta = z.infer<typeof ProjectMetaSchema>;
