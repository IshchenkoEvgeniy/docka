import { useState } from 'react';
import { THEMES, type Theme } from '../../core';
import { t } from '../../i18n';
import { Button, Segmented } from '../../ui';
import { useWorkspace, useWorkspaceState } from '../workspace';
import { FolderBar } from './FolderBar';
import { NewProjectDialog } from './NewProjectDialog';
import { ProjectTile } from './ProjectTile';
import { useProjects } from './useProjects';
import styles from './Home.module.css';

function Favorites() {
  const workspace = useWorkspace();
  const favorites = useWorkspaceState((state) => state.settings.favorites);
  if (favorites.length === 0) return null;
  return (
    <section className={styles.section}>
      <h2 className={styles.sectionTitle}>{t('home.favorites')}</h2>
      <div className={styles.chips}>
        {favorites.map((favorite) => (
          <Button
            key={`${favorite.projectFolder}/${favorite.boardId}`}
            onClick={() => {
              workspace.openProject(favorite.projectFolder, favorite.boardId);
            }}
          >
            {`★ ${favorite.title}`}
          </Button>
        ))}
      </div>
    </section>
  );
}

/** Главный экран: проекты плитками, избранные доски, новый проект, тема. */
export function HomeScreen() {
  const workspace = useWorkspace();
  const { services } = workspace;
  const theme = useWorkspaceState((state) => state.settings.theme);
  const inboxCount = useWorkspaceState((state) => state.inbox.length);
  const projectPaths = useWorkspaceState((state) => state.settings.projectPaths);
  const { entries, error } = useProjects(services, projectPaths);
  const [creating, setCreating] = useState(false);
  const themeOptions = THEMES.map((value) => ({ value, label: t(`settings.theme.${value}`) }));
  return (
    <div className={styles.home}>
      <header className={styles.header}>
        <h1 className={styles.title}>{t('app.title')}</h1>
        <div className={styles.headerActions}>
          <Segmented<Theme>
            label={t('settings.theme.label')}
            value={theme}
            options={themeOptions}
            onChange={(value) => {
              workspace.updateSettings({ theme: value });
            }}
          />
          <Button variant="ghost" onClick={workspace.openSettings}>
            {t('home.settings')}
          </Button>
        </div>
      </header>
      <main className={styles.content}>
        {inboxCount > 0 && (
          <p className={styles.inbox} role="status">
            {t('home.inbox', { count: inboxCount })}
          </p>
        )}
        <Favorites />
        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>
              {entries === null
                ? t('home.projects')
                : t('home.projectsCount', { count: entries.length })}
            </h2>
            <Button
              variant="primary"
              onClick={() => {
                setCreating(true);
              }}
            >
              {t('home.newProject')}
            </Button>
          </div>
          <FolderBar />
          {error !== null && <p className={styles.error}>{error}</p>}
          {entries !== null && entries.length === 0 && (
            <p className={styles.empty}>{t('home.empty')}</p>
          )}
          <div className={styles.grid}>
            {entries?.map((entry) => (
              <ProjectTile key={entry.folder} entry={entry} />
            ))}
          </div>
        </section>
      </main>
      {creating && (
        <NewProjectDialog
          onClose={() => {
            setCreating(false);
          }}
        />
      )}
    </div>
  );
}
