import {
  fieldValue,
  fieldsOf,
  optionsOf,
  selectedIds,
  type Entity,
  type EntityType,
  type FieldWithId,
} from '../../core';
import { optionName } from '../../elements';

/** Сортировка таблицы библиотеки: по названию или по значению поля. */
export interface LibrarySort {
  /** 'name', 'type' или id поля. */
  readonly key: string;
  readonly descending: boolean;
}

/** Текст или число, по которому сравниваются значения поля. */
export function sortValue(
  entity: Entity,
  field: FieldWithId,
  names: ReadonlyMap<string, Entity>,
): string | number {
  if (field.kind === 'relation')
    return selectedIds(field, entity.values)
      .map((id) => names.get(id)?.name ?? '')
      .join(', ');
  if (field.kind === 'select' || field.kind === 'multiSelect') {
    const chosen = new Set(selectedIds(field, entity.values));
    return optionsOf(field)
      .filter((option) => chosen.has(option.id))
      .map(optionName)
      .join(', ');
  }
  const value = fieldValue(field, entity.values);
  if (typeof value === 'number') return value;
  if (typeof value === 'boolean') return value ? 1 : 0;
  return typeof value === 'string' ? value : '';
}

function compare(a: string | number, b: string | number): number {
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return String(a).localeCompare(String(b), undefined, { numeric: true });
}

/** Пустые значения — всегда в конце, в любом направлении сортировки. */
function compareSorted(a: string | number, b: string | number, sign: number): number {
  if (a === '' || b === '') return a === b ? 0 : a === '' ? 1 : -1;
  return sign * compare(a, b);
}

/** Сущности после фильтра и сортировки. */
export function filterAndSort(
  entities: ReadonlyMap<string, Entity>,
  types: ReadonlyMap<string, EntityType>,
  options: { readonly typeId: string | null; readonly query: string; readonly sort: LibrarySort },
  typeLabel: (type: EntityType) => string,
): Entity[] {
  const needle = options.query.trim().toLocaleLowerCase();
  const type = options.typeId === null ? undefined : types.get(options.typeId);
  const sortField =
    type === undefined ? undefined : fieldsOf(type).find((field) => field.id === options.sort.key);
  const key = (entity: Entity): string | number => {
    if (sortField !== undefined) return sortValue(entity, sortField, entities);
    if (options.sort.key === 'type') {
      const entityType = types.get(entity.typeId);
      return entityType === undefined ? '' : typeLabel(entityType);
    }
    return entity.name;
  };
  const sign = options.sort.descending ? -1 : 1;
  return [...entities.values()]
    .filter((entity) => types.has(entity.typeId))
    .filter((entity) => options.typeId === null || entity.typeId === options.typeId)
    .filter((entity) => needle === '' || entity.name.toLocaleLowerCase().includes(needle))
    .sort((a, b) => compareSorted(key(a), key(b), sign) || compare(a.name, b.name));
}
