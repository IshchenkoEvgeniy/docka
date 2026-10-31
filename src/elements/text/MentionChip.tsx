import { CONTROL_ATTRIBUTE } from '../../canvas';
import { TAG_MENTION_CHAR } from '../../core';
import { t } from '../../i18n';
import { cardColor } from '../../ui';
import { useEntities, useEntityLinks, useTags } from '../entityLinks';
import { entityName } from '../entityLabels';
import styles from './Text.module.css';

const control = { [CONTROL_ATTRIBUTE]: '' };

/** Тег в тексте: цветной чип с актуальным именем (ADR 0006). */
function TagChip({ id, label }: { readonly id: string; readonly label: string }) {
  const tag = useTags().get(id);
  return (
    <span
      className={tag === undefined ? styles.mentionMissing : styles.tagChip}
      style={tag === undefined ? undefined : { background: cardColor(tag.color) }}
    >
      {`${TAG_MENTION_CHAR}${tag?.name ?? label}`}
    </span>
  );
}

/** Упоминание сущности: актуальное название, щелчок открывает её. */
function EntityMention({ id, label }: { readonly id: string; readonly label: string }) {
  const entity = useEntities().get(id);
  const links = useEntityLinks();
  const missing = entity === undefined;
  return (
    <button
      {...control}
      type="button"
      className={missing ? styles.mentionMissing : styles.mention}
      title={missing ? t('entities.missing') : undefined}
      onClick={(event) => {
        event.stopPropagation();
        links?.openEntity(id);
      }}
    >
      {`@${missing ? label : entityName(entity.name)}`}
    </button>
  );
}

export function MentionChip({
  id,
  label,
  char,
}: {
  readonly id: string;
  readonly label: string;
  readonly char: string;
}) {
  return char === TAG_MENTION_CHAR ? (
    <TagChip id={id} label={label} />
  ) : (
    <EntityMention id={id} label={label} />
  );
}
