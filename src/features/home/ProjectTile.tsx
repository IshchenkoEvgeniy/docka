import { isProjectPath, type ProjectEntry } from '../../data';
import { formatDateTime, t } from '../../i18n';
import { Button, cx } from '../../ui';
import { useWorkspace } from '../workspace';
import styles from './Home.module.css';

function describe(entry: ProjectEntry): string {
  if (entry.status !== 'ok') return entry.error;
  return entry.modifiedAt === null
    ? t('home.neverChanged')
    : t('home.changed', { date: formatDateTime(entry.modifiedAt) });
}

/** Плитка проекта. У проекта из другой папки виден путь, и его можно убрать из списка. */
export function ProjectTile({
  entry,
  onDelete,
}: {
  readonly entry: ProjectEntry;
  readonly onDelete: (entry: Extract<ProjectEntry, { status: 'ok' }>) => void;
}) {
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
      <div className={styles.tileActions}>
        {entry.status === 'ok' && (
          <Button
            aria-label={t('home.deleteProjectNamed', { name })}
            onClick={() => {
              onDelete(entry);
            }}
          >
            {t('home.deleteProject')}
          </Button>
        )}
        {external && (
          <Button
            variant="ghost"
            onClick={() => {
              workspace.removeProjectPath(entry.folder);
            }}
          >
            {t('home.removeFromList')}
          </Button>
        )}
      </div>
    </div>
  );
}
