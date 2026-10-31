import { isProjectPath, type ProjectEntry } from '../../data';
import { formatDateTime, t } from '../../i18n';
import { cx } from '../../ui';
import { useWorkspace } from '../workspace';
import styles from './Home.module.css';

function describe(entry: ProjectEntry): string {
  if (entry.status !== 'ok') return entry.error;
  return entry.modifiedAt === null
    ? t('home.neverChanged')
    : t('home.changed', { date: formatDateTime(entry.modifiedAt) });
}

/** Плитка проекта. У проекта из другой папки виден путь, и его можно убрать из списка. */
export function ProjectTile({ entry }: { readonly entry: ProjectEntry }) {
  const workspace = useWorkspace();
  const usable = entry.status === 'ok';
  const external = isProjectPath(entry.folder);
  const name = usable ? entry.meta.name : entry.folder;
  return (
    <div className={styles.tileWrap}>
      <button
        type="button"
        className={cx(styles.tile, !usable && styles.tileDisabled)}
        disabled={!usable}
        onClick={() => {
          workspace.openProject(entry.folder);
        }}
      >
        <span className={styles.cover} aria-hidden="true">
          {name.slice(0, 1).toUpperCase()}
        </span>
        <span className={styles.tileName}>{name}</span>
        <span className={styles.tileMeta}>{describe(entry)}</span>
        {external && usable && <span className={styles.tilePath}>{entry.folder}</span>}
      </button>
      {external && (
        <button
          type="button"
          className={styles.remove}
          title={t('home.removeFromList')}
          aria-label={t('home.removeFromList')}
          onClick={() => {
            workspace.removeProjectPath(entry.folder);
          }}
        >
          {t('home.removeIcon')}
        </button>
      )}
    </div>
  );
}
