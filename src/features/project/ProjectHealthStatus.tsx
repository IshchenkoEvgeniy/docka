import { useStore } from 'zustand';
import type { OpenProject } from '../../data';
import { t } from '../../i18n';
import { Button } from '../../ui';
import type { ProjectHealth } from './projectHealth';
import styles from './ProjectHealthStatus.module.css';

export function ProjectHealthStatus({
  health,
  project,
}: {
  readonly health: ProjectHealth;
  readonly project: OpenProject;
}) {
  const { saving, warning } = useStore(health.store);
  const retry = (): void => {
    project.flushAll().catch((error: unknown) => {
      console.error('Повторное сохранение не удалось', error);
    });
  };
  return (
    <div className={styles.status}>
      <span
        role={saving === 'error' ? 'alert' : 'status'}
        className={saving === 'error' ? styles.error : undefined}
      >
        {t(`project.save.${saving}`)}
      </span>
      {saving === 'error' && <Button onClick={retry}>{t('project.save.retry')}</Button>}
      {warning !== null && (
        <>
          <span className={styles.error} role="alert">
            {t(`project.save.${warning}`)}
          </span>
          <Button variant="ghost" onClick={health.dismiss}>
            {t('common.close')}
          </Button>
        </>
      )}
    </div>
  );
}
