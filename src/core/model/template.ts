import { z } from 'zod';
import { BOARD_BACKGROUNDS } from './board';
import { ColorNameSchema } from './color';
import { LINE_STYLES } from './connection';
import { FIELD_KINDS } from './entity';
import { BUILTIN_TYPE_KEYS } from './entityBuiltinKeys';
import { ElementTypeSchema } from './element';
import { KeySchema } from './ids';
import { RichTextSchema } from './richText';

/**
 * Шаблон доски или проекта (ADR 0006): дерево досок с элементами, стрелками и типами сущностей.
 * Ссылки внутри — номерами в списках, теги — именами: шаблон подходит любому проекту.
 */
const size = z.number().positive().max(100_000);
const coordinate = z.number().min(-1_000_000).max(1_000_000);

export const TemplateElementSchema = z.object({
  type: ElementTypeSchema,
  x: coordinate,
  y: coordinate,
  width: size,
  height: size,
  color: ColorNameSchema.optional(),
  data: z.record(z.string(), z.unknown()).optional(),
  /** Форматированный текст; у встроенных шаблонов можно проще — text. */
  richText: RichTextSchema.optional(),
  text: z.string().max(20_000).optional(),
  /** Карточка колонки: номер колонки в этом же списке. */
  parentIndex: z.number().int().nonnegative().optional(),
  /** Карточка вложенной доски: номер дочерней доски шаблона. */
  board: z.number().int().nonnegative().optional(),
  tags: z.array(z.string().max(100)).max(50).optional(),
});
export type TemplateElement = z.infer<typeof TemplateElementSchema>;

export const TemplateConnectionSchema = z.object({
  from: z.number().int().nonnegative(),
  to: z.number().int().nonnegative(),
  label: z.string().max(500).optional(),
  lineStyle: z.enum(LINE_STYLES).optional(),
});

export interface TemplateBoard {
  readonly title: string;
  readonly background?: (typeof BOARD_BACKGROUNDS)[number] | undefined;
  readonly elements: readonly TemplateElement[];
  readonly connections?: readonly z.infer<typeof TemplateConnectionSchema>[] | undefined;
  readonly children?: readonly TemplateBoard[] | undefined;
}

export const TemplateBoardSchema: z.ZodType<TemplateBoard> = z.lazy(() =>
  z.object({
    title: z.string().min(1).max(200),
    background: z.enum(BOARD_BACKGROUNDS).optional(),
    elements: z.array(TemplateElementSchema).max(5000),
    connections: z.array(TemplateConnectionSchema).max(5000).optional(),
    children: z.array(TemplateBoardSchema).max(200).optional(),
  }),
);

export const TemplateFieldSchema = z.object({
  name: z.string().min(1).max(100),
  kind: z.enum(FIELD_KINDS),
  onCard: z.boolean().optional(),
  options: z.array(z.string().min(1).max(100)).max(100).optional(),
  /** Связь: ключ типа в этом шаблоне (или встроенного: npc, location, item). */
  target: z.string().max(64).optional(),
  multiple: z.boolean().optional(),
  backName: z.string().max(100).optional(),
});

export const TemplateEntityTypeSchema = z.object({
  /** Ключ для ссылок внутри шаблона. */
  key: z.string().min(1).max(64),
  /** Встроенный тип: берётся тот, что уже есть в проекте, поля не создаются. */
  builtin: z.enum(BUILTIN_TYPE_KEYS).optional(),
  name: z.string().max(100),
  icon: z.string().max(16),
  color: ColorNameSchema,
  fields: z.array(TemplateFieldSchema).max(100),
});
export type TemplateEntityType = z.infer<typeof TemplateEntityTypeSchema>;

export const TemplateSchema = z.object({
  app: z.literal('doska'),
  kind: z.literal('template'),
  version: z.literal(1),
  id: KeySchema,
  /** board — новая доска внутри текущей; project — содержимое нового проекта. */
  scope: z.enum(['board', 'project']),
  name: z.string().min(1).max(200),
  description: z.string().max(1000),
  board: TemplateBoardSchema,
  entityTypes: z.array(TemplateEntityTypeSchema).max(100),
});
export type Template = z.infer<typeof TemplateSchema>;
