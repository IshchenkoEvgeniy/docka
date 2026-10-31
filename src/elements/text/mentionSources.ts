import { normalizeTagName } from '../../core';
import { t } from '../../i18n';
import type { EntityLinks } from '../entityLinks';
import { entityName, typeName } from '../entityLabels';
import type { MentionSource } from './mentions';

/** Ссылка на текущие сущности и теги: берутся в момент набора, поэтому всегда свежие. */
interface LinksRef {
  readonly current: EntityLinks | null;
}

const needleOf = (query: string) => query.trim().toLocaleLowerCase();

export function entitySource(links: LinksRef): MentionSource {
  return {
    find: (query) => {
      const directory = links.current?.directory;
      if (directory === undefined) return [];
      const types = directory.types.getSnapshot();
      const needle = needleOf(query);
      return [...directory.entities.getSnapshot().values()]
        .filter((entity) => entity.name.toLocaleLowerCase().includes(needle))
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((entity) => {
          const type = types.get(entity.typeId);
          return {
            id: entity.id,
            label: entityName(entity.name),
            hint: type === undefined ? '' : typeName(type),
          };
        });
    },
    labelOf: (id) => {
      const entity = links.current?.directory.entities.getSnapshot().get(id);
      return entity === undefined ? null : entityName(entity.name);
    },
  };
}

/** Теги для «#»: подходящие по началу имени и пункт «новый тег», если такого ещё нет. */
export function tagSource(links: LinksRef): MentionSource {
  return {
    find: (query) => {
      const tags = [...(links.current?.tags.getSnapshot().values() ?? [])].filter(
        (tag) => tag.mergedInto === undefined || tag.mergedInto === null,
      );
      const needle = needleOf(query);
      const found = tags
        .filter((tag) => tag.name.toLocaleLowerCase().includes(needle))
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((tag) => ({ id: tag.id, label: tag.name, hint: '' }));
      const name = normalizeTagName(query);
      const exists = tags.some((tag) => tag.name.toLocaleLowerCase() === name.toLocaleLowerCase());
      if (name === '' || exists || links.current === null) return found;
      return [...found, { id: `new:${name}`, label: name, hint: t('tags.newHint'), create: true }];
    },
    labelOf: (id) => links.current?.tags.getSnapshot().get(id)?.name ?? null,
    create: (label) => links.current?.createTag(label) ?? null,
  };
}
