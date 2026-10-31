import { CONTROL_ATTRIBUTE } from '../../canvas';
import { t } from '../../i18n';
import { useEntities, useEntityLinks } from '../entityLinks';
import { entityName } from '../entityLabels';
import styles from './Text.module.css';

const control = { [CONTROL_ATTRIBUTE]: '' };

/** Упоминание в тексте: актуальное название сущности, щелчок открывает её. */
export function MentionChip({ id, label }: { readonly id: string; readonly label: string }) {
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
