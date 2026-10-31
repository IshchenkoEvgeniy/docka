import { z } from 'zod';
import type { FileSystem } from '../core';

/**
 * Устройства проекта: у каждого своя папка data/<deviceId>/. Чтобы на других устройствах было
 * видно понятное имя («Телефон»), устройство кладёт туда device.json.
 */
const DEVICE_FILE = 'device.json';
const DeviceFileSchema = z.object({ name: z.string().max(80) });

export interface ProjectDevice {
  readonly deviceId: string;
  /** null — устройство ещё не записало имя (старая версия приложения). */
  readonly name: string | null;
  /** Последнее изменение его файлов в этом проекте (мс). */
  readonly lastChange: number | null;
}

async function readName(fs: FileSystem, deviceId: string): Promise<string | null> {
  const raw = await fs.readFile(`data/${deviceId}/${DEVICE_FILE}`);
  if (raw === null) return null;
  try {
    const parsed = DeviceFileSchema.safeParse(JSON.parse(new TextDecoder().decode(raw)));
    return parsed.success ? parsed.data.name : null;
  } catch {
    return null;
  }
}

/** Записывает имя этого устройства в проект, если оно изменилось. */
export async function recordDeviceName(
  fs: FileSystem,
  deviceId: string,
  name: string,
): Promise<void> {
  if ((await readName(fs, deviceId)) === name) return;
  const data = new TextEncoder().encode(JSON.stringify({ name }));
  await fs.writeFileAtomic(`data/${deviceId}/${DEVICE_FILE}`, data);
}

/** Устройства, писавшие в проект, — новые изменения сверху. */
export async function listProjectDevices(fs: FileSystem): Promise<ProjectDevice[]> {
  const ids = await fs.listDir('data');
  const devices = await Promise.all(
    ids.map(async (deviceId) => ({
      deviceId,
      name: await readName(fs, deviceId),
      lastChange: await fs.latestChange(`data/${deviceId}`),
    })),
  );
  return devices.sort((a, b) => (b.lastChange ?? 0) - (a.lastChange ?? 0));
}
