import { useEffect, useState } from 'react';
import { listProjectDevices, type ProjectDevice } from '../../data';
import { formatDateTime, t } from '../../i18n';
import { Button, Dialog } from '../../ui';
import { projectLocation, useWorkspace, useWorkspaceState } from '../workspace';
import styles from './Project.module.css';

function DeviceList({ folder }: { readonly folder: string }) {
  const { services } = useWorkspace();
  const deviceId = useWorkspaceState((state) => state.settings.deviceId);
  const [devices, setDevices] = useState<readonly ProjectDevice[] | null>(null);
  useEffect(() => {
    let active = true;
    projectLocation(services, folder)
      .then((location) => listProjectDevices(location.fs))
      .then(
        (list) => {
          if (active) setDevices(list);
        },
        (error: unknown) => {
          console.error('Список устройств не прочитан', error);
          if (active) setDevices([]);
        },
      );
    return () => {
      active = false;
    };
  }, [services, folder]);
  if (devices === null) return <p>{t('project.loading')}</p>;
  return (
    <ul className={styles.devices}>
      {devices.map((device) => (
        <li key={device.deviceId} className={styles.device}>
          <span className={styles.deviceName}>
            {device.name ?? t('project.sync.unnamed')}
            {device.deviceId === deviceId && ` ${t('project.sync.thisDevice')}`}
          </span>
          <span className={styles.deviceTime}>
            {device.lastChange === null
              ? t('home.neverChanged')
              : t('home.changed', { date: formatDateTime(device.lastChange) })}
          </span>
        </li>
      ))}
    </ul>
  );
}

/** Кнопка в шапке проекта: какие устройства и когда последний раз меняли проект. */
export function SyncStatus({ folder }: { readonly folder: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        variant="ghost"
        aria-label={t('project.sync.title')}
        title={t('project.sync.title')}
        onClick={() => {
          setOpen(true);
        }}
      >
        {'⇅'}
      </Button>
      {open && (
        <Dialog
          title={t('project.sync.title')}
          closeLabel={t('common.close')}
          onClose={() => {
            setOpen(false);
          }}
        >
          <p className={styles.syncHint}>{t('project.sync.hint')}</p>
          <DeviceList folder={folder} />
        </Dialog>
      )}
    </>
  );
}
