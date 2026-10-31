import type { TagSet } from '../../core';
import { useTags } from '../../elements';
import { Chip, cardColor } from '../../ui';
import { liveTags } from './tree';
import styles from './Tags.module.css';

/** Теги записи цветными метками (под карточкой на доске, в панели сущности). */
export function TagChips({ tags }: { readonly tags: Readonly<TagSet> }) {
  const all = useTags();
  const shown = liveTags(tags, all);
  if (shown.length === 0) return null;
  return (
    <span className={styles.chips}>
      {shown.map((tag) => (
        <Chip key={tag.id} label={tag.name} color={cardColor(tag.color)} />
      ))}
    </span>
  );
}
