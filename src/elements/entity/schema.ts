import { z } from 'zod';
import { EntityIdSchema } from '../../core';

/** Вид представления сущности на доске (ТЗ, раздел 6): у каждого размещения свой. */
export const ENTITY_VIEWS = ['chip', 'card', 'full'] as const;
export type EntityView = (typeof ENTITY_VIEWS)[number];

/** На доске — только ссылка на сущность проекта и вид; данные общие (ADR 0004). */
export const EntityElementDataSchema = z.object({
  entityId: EntityIdSchema,
  view: z.enum(ENTITY_VIEWS),
});
export type EntityElementData = z.infer<typeof EntityElementDataSchema>;

/** Тип элемента-представления сущности. */
export const ENTITY_ELEMENT_TYPE = 'entity';

/** Ширина нового размещения по виду. */
export const ENTITY_VIEW_WIDTH: Readonly<Record<EntityView, number>> = {
  chip: 200,
  card: 260,
  full: 320,
};
