import { useState } from 'react';
import { THEMES, ZOOMED_OUT_VIEWS, type Theme, type ZoomedOutView } from '../../core';
import { t, type TranslationKey } from '../../i18n';
import { Button, Segmented, TextField } from '../../ui';
import { BOARD_HOTKEYS } from '../board';
import { HotkeyList } from '../hotkeys';
import { useWorkspace, useWorkspaceState } from '../workspace';
import { ProjectsFolder } from './ProjectsFolder';
import styles from './Settings.module.css';

const SYNC_STEPS: readonly TranslationKey[] = [
  'settings.sync.step1',
  'settings.sync.step2',
  'settings.sync.step3',
  'settings.sync.step4',
  'settings.sync.step5',
];

function DeviceSection() {
  const workspace = useWorkspace();
  const settings = useWorkspaceState((state) => state.settings);
  const [name, setName] = useState(settings.deviceName);
  const save = (): void => {
    const trimmed = name.trim();
    if (trimmed !== '' && trimmed !== settings.deviceName)
      workspace.updateSettings({ deviceName: trimmed });
  };
  return (
    <section className={styles.section}>
      <h2 className={styles.heading}>{t('settings.device.title')}</h2>
      <TextField
        label={t('settings.device.name')}
        value={name}
        maxLength={80}
        onChange={(event) => {
          setName(event.target.value);
        }}
        onBlur={save}
      />
      <p className={styles.hint}>{t('settings.device.hint', { id: settings.deviceId })}</p>
    </section>
  );
}

/** Как выглядят карточки, когда доску отдалили (ADR 0001). */
function ZoomedOutSection() {
  const workspace = useWorkspace();
  const view = useWorkspaceState((state) => state.settings.zoomedOutView);
  return (
    <section className={styles.section}>
      <h2 className={styles.heading}>{t('settings.zoomedOut.title')}</h2>
      <Segmented<ZoomedOutView>
        label={t('settings.zoomedOut.title')}
        value={view}
        options={ZOOMED_OUT_VIEWS.map((value) => ({
          value,
          label: t(`settings.zoomedOut.${value}`),
        }))}
        onChange={(value) => {
          workspace.updateSettings({ zoomedOutView: value });
        }}
      />
      <p className={styles.hint}>{t(`settings.zoomedOut.${view}Hint`)}</p>
    </section>
  );
}

/** Настройки устройства: имя, тема, папка проектов, синхронизация, горячие клавиши. */
export function SettingsScreen() {
  const workspace = useWorkspace();
  const theme = useWorkspaceState((state) => state.settings.theme);
  return (
    <div className={styles.screen}>
      <header className={styles.header}>
        <Button variant="ghost" onClick={workspace.goHome}>
          {t('project.backToProjects')}
        </Button>
        <h1 className={styles.title}>{t('settings.title')}</h1>
      </header>
      <main className={styles.content}>
        <DeviceSection />
        <section className={styles.section}>
          <h2 className={styles.heading}>{t('settings.theme.label')}</h2>
          <Segmented<Theme>
            label={t('settings.theme.label')}
            value={theme}
            options={THEMES.map((value) => ({ value, label: t(`settings.theme.${value}`) }))}
            onChange={(value) => {
              workspace.updateSettings({ theme: value });
            }}
          />
        </section>
        <ZoomedOutSection />
        <ProjectsFolder />
        <section className={styles.section}>
          <h2 className={styles.heading}>{t('settings.sync.title')}</h2>
          <ol className={styles.steps}>
            {SYNC_STEPS.map((step) => (
              <li key={step}>{t(step)}</li>
            ))}
          </ol>
          <p className={styles.hint}>{t('settings.sync.note')}</p>
        </section>
        <section className={styles.section}>
          <h2 className={styles.heading}>{t('hotkeys.title')}</h2>
          <HotkeyList definitions={BOARD_HOTKEYS} />
        </section>
      </main>
    </div>
  );
}
