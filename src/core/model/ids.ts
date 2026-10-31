import { z } from 'zod';

/**
 * Идентификаторы сущностей. Формат одинаковый для всех: 8–64 символа из латиницы, цифр, «_» и «-»
 * (подходит и для имён файлов). Разные виды id — разные типы, их нельзя перепутать.
 */
const idString = z.string().regex(/^[A-Za-z0-9_-]{8,64}$/, 'Некорректный идентификатор');

export const ProjectIdSchema = idString.brand<'ProjectId'>();
export const BoardIdSchema = idString.brand<'BoardId'>();
export const ElementIdSchema = idString.brand<'ElementId'>();
export const ConnectionIdSchema = idString.brand<'ConnectionId'>();
export const TagIdSchema = idString.brand<'TagId'>();
export const EntityTypeIdSchema = idString.brand<'EntityTypeId'>();
export const EntityIdSchema = idString.brand<'EntityId'>();
/** Ключи внутри записей: id поля типа сущности, id варианта списка. */
export const KeySchema = idString;
/** Устройство: имя его папки data/<deviceId>/ в проекте. */
export const DeviceIdSchema = idString.brand<'DeviceId'>();

export type ProjectId = z.infer<typeof ProjectIdSchema>;
export type BoardId = z.infer<typeof BoardIdSchema>;
export type ElementId = z.infer<typeof ElementIdSchema>;
export type ConnectionId = z.infer<typeof ConnectionIdSchema>;
export type TagId = z.infer<typeof TagIdSchema>;
export type EntityTypeId = z.infer<typeof EntityTypeIdSchema>;
export type EntityId = z.infer<typeof EntityIdSchema>;
export type DeviceId = z.infer<typeof DeviceIdSchema>;

/** Момент времени: миллисекунды с 1970-01-01 UTC. */
export const TimestampSchema = z.number().int().nonnegative();
export type Timestamp = z.infer<typeof TimestampSchema>;
