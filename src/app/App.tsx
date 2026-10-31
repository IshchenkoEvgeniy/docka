import { useEffect, useState } from 'react';
import { loadCameraMemory, loadDeviceSettings } from '../data';
import {
  HomeScreen,
  ProjectScreen,
  SettingsScreen,
  WorkspaceContext,
  createWorkspace,
  useHistorySync,
  useSharedInbox,
  useWorkspaceState,
  type Workspace,
} from '../features';
import { DEFAULT_LANGUAGE, t } from '../i18n';
import { applyTheme } from '../ui';
import { CanvasBenchmark } from './dev/CanvasBenchmark';
import { createPlatform } from './services';
import styles from './App.module.css';

async function startWorkspace(): Promise<Workspace> {
  const platform = await createPlatform();
  const defaults = {
    deviceName: t(`settings.defaultDeviceName.${platform.deviceKind}`),
    language: DEFAULT_LANGUAGE,
  };
  const settings = await loadDeviceSettings(platform.settingsFs, defaults, platform.ids);
  const services = await platform.complete(settings.projectsFolder);
  const cameras = await loadCameraMemory(services.settingsFs, services.clock);
  return createWorkspace(services, settings, cameras);
}

function Screens() {
  useHistorySync();
  useSharedInbox();
  const route = useWorkspaceState((state) => state.route);
  const theme = useWorkspaceState((state) => state.settings.theme);
  useEffect(() => {
    applyTheme(theme);
  }, [theme]);
  if (route.screen === 'project')
    return <ProjectScreen key={route.folder} folder={route.folder} boardId={route.boardId} />;
  if (route.screen === 'settings') return <SettingsScreen />;
  return <HomeScreen />;
}

type Startup =
  | { readonly status: 'loading' }
  | { readonly status: 'ready'; readonly workspace: Workspace }
  | { readonly status: 'failed'; readonly error: string };

/** Запуск: службы платформы → настройки устройства → экраны. Замер холста — по адресу #benchmark. */
export function App() {
  const [startup, setStartup] = useState<Startup>({ status: 'loading' });
  useEffect(() => {
    startWorkspace().then(
      (workspace) => {
        setStartup({ status: 'ready', workspace });
      },
      (error: unknown) => {
        setStartup({ status: 'failed', error: String(error) });
      },
    );
  }, []);
  if (window.location.hash === '#benchmark') return <CanvasBenchmark />;
  if (startup.status !== 'ready')
    return (
      <div className={styles.splash}>
        {startup.status === 'failed'
          ? t('app.startFailed', { error: startup.error })
          : t('app.loading')}
      </div>
    );
  return (
    <WorkspaceContext.Provider value={startup.workspace}>
      <Screens />
    </WorkspaceContext.Provider>
  );
}
