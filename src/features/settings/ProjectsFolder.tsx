import { useState } from 'react';
import { t } from '../../i18n';
import { Button } from '../../ui';
import { useWorkspace, useWorkspaceState } from '../workspace';
import styles from './Settings.module.css';

/**
 * Папка проектов — её же добавляют в Syncthing. На компьютере — выбор папки, на телефоне —
 * общая папка памяти (нужен доступ ко всем файлам). После смены приложение перезапускается.
 */
export function ProjectsFolder() {
  const workspace = useWorkspace();
  const { services } = workspace;
  const custom = useWorkspaceState((state) => state.settings.projectsFolder);
  const [access, setAccess] = useState(() => services.storage?.hasAllFilesAccess() ?? true);
  const change = (folder: string | null): void => {
    workspace.updateSettings({ projectsFolder: folder });
    // Настройки пишутся в фоне — даём им записаться до перезапуска.
    setTimeout(services.restart, 300);
  };
  const storage = services.storage;
  return (
    <section className={styles.section}>
      <h2 className={styles.heading}>{t('settings.folder.title')}</h2>
      <p className={styles.path}>{services.projectsFolderLabel}</p>
      {services.projectsFolderError !== null && (
        <p className={styles.error}>
          {t('settings.folder.failed', { error: services.projectsFolderError })}
        </p>
      )}
      <p className={styles.hint}>{t('settings.folder.hint')}</p>
      <div className={styles.actions}>
        {services.pickFolder !== null && (
          <Button
            onClick={() => {
              void services.pickFolder?.(t('settings.folder.pick')).then((folder) => {
                if (folder !== null) change(folder);
              });
            }}
          >
            {t('settings.folder.pick')}
          </Button>
        )}
        {storage !== null && !access && (
          <Button
            variant="primary"
            onClick={() => {
              storage.requestAllFilesAccess();
            }}
          >
            {t('settings.folder.grant')}
          </Button>
        )}
        {storage !== null && (
          <Button
            disabled={!access}
            onClick={() => {
              change(storage.suggestedProjectsFolder());
            }}
          >
            {t('settings.folder.useShared', { path: storage.suggestedProjectsFolder() })}
          </Button>
        )}
        {storage !== null && !access && (
          <Button
            variant="ghost"
            onClick={() => {
              setAccess(storage.hasAllFilesAccess());
            }}
          >
            {t('settings.folder.recheck')}
          </Button>
        )}
        {custom !== null && (
          <Button
            variant="ghost"
            onClick={() => {
              change(null);
            }}
          >
            {t('settings.folder.reset')}
          </Button>
        )}
      </div>
    </section>
  );
}
