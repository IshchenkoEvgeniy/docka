import {
  DeviceIdSchema,
  SETTINGS_VERSION,
  parseDeviceSettings,
  type DeviceSettings,
  type FileSystem,
  type IdGenerator,
} from '../core';

/** settings.json в папке настроек приложения (вне синхронизации). */
export const SETTINGS_FILE = 'settings.json';

const encoder = new TextEncoder();
const decoder = new TextDecoder();

export interface SettingsDefaults {
  readonly deviceName: string;
  readonly language: string;
}

function parseJson(raw: Uint8Array | null): unknown {
  if (raw === null) return null;
  try {
    return JSON.parse(decoder.decode(raw));
  } catch {
    return null;
  }
}

export async function saveDeviceSettings(fs: FileSystem, settings: DeviceSettings): Promise<void> {
  await fs.writeFileAtomic(SETTINGS_FILE, encoder.encode(JSON.stringify(settings, null, 2)));
}

/**
 * Настройки устройства. При первом запуске создаётся постоянный id устройства;
 * битые поля заменяются значениями по умолчанию, а id сохраняется, если его можно прочитать.
 */
export async function loadDeviceSettings(
  fs: FileSystem,
  defaults: SettingsDefaults,
  ids: IdGenerator,
): Promise<DeviceSettings> {
  const raw = parseJson(await fs.readFile(SETTINGS_FILE));
  const fallback: DeviceSettings = {
    version: SETTINGS_VERSION,
    deviceId: DeviceIdSchema.parse(ids.next()),
    deviceName: defaults.deviceName,
    theme: 'system',
    language: defaults.language,
    projectsFolder: null,
    favorites: [],
    projectPaths: [],
  };
  const settings = parseDeviceSettings(raw, fallback);
  if (JSON.stringify(settings) !== JSON.stringify(raw)) await saveDeviceSettings(fs, settings);
  return settings;
}
