import { useState } from 'react';
import { t } from '../../i18n';
import { Button } from '../../ui';
import { useWorkspace, useWorkspaceState } from '../workspace';
import { addExistingProject } from './placement';
import styles from './Home.module.css';

/** Телефон: проекты во внутренней папке приложения — Syncthing и проводник их не видят. */
function HiddenFolderNotice() {
  const workspace = useWorkspace();
  const custom = useWorkspaceState((state) => state.settings.projectsFolder);
  if (workspace.services.storage === null || custom !== null) return null;
  return (
    <div className={styles.notice} role="status">
      <p className={styles.noticeText}>{t('home.hiddenFolder')}</p>
      <Button variant="primary" onClick={workspace.openSettings}>
        {t('home.moveToShared')}
      </Button>
    </div>
  );
}

/** Где лежат проекты: путь папки, смена папки и открытие проекта из другой папки. */
export function FolderBar() {
  const workspace = useWorkspace();
  const { services } = workspace;
  const [error, setError] = useState<string | null>(null);
  const pick = services.openFolder === null ? null : services.pickFolder;
  const openExisting = (): void => {
    if (pick === null) return;
    void pick(t('home.openExisting'))
      .then((path) => (path === null ? null : addExistingProject(workspace, path)))
      .then(
        (placed) => {
          if (placed === null) return;
          if (placed.ok) workspace.openProject(placed.key);
          else setError(placed.error);
        },
        (failure: unknown) => {
          setError(String(failure));
        },
      );
  };
  return (
    <>
      <HiddenFolderNotice />
      <div className={styles.folderBar}>
        <p className={styles.folder}>{t('home.folder', { path: services.projectsFolderLabel })}</p>
        <div className={styles.locationActions}>
          <Button variant="ghost" onClick={workspace.openSettings}>
            {t('home.changeFolder')}
          </Button>
          {pick !== null && (
            <Button variant="ghost" onClick={openExisting}>
              {t('home.openExisting')}
            </Button>
          )}
        </div>
      </div>
      {error !== null && <p className={styles.error}>{error}</p>}
    </>
  );
}
