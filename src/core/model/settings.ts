import { z } from 'zod';
import { BoardIdSchema, DeviceIdSchema, ProjectIdSchema } from './ids';

/**
 * Настройки устройства (settings.json в папке приложения, НЕ синхронизируются):
 * у каждого устройства свои id, имя, тема и папка проектов.
 */

export const THEMES = ['system', 'light', 'dark'] as const;
export type Theme = (typeof THEMES)[number];

/** Избранная доска на главном экране; название запоминается, чтобы не открывать проект ради списка. */
export const FavoriteSchema = z.object({
  projectId: ProjectIdSchema,
  /** Имя подпапки в папке проектов или полный путь проекта в другом месте. */
  projectFolder: z.string().min(1).max(1000),
  boardId: BoardIdSchema,
  title: z.string().max(200),
});
export type Favorite = z.infer<typeof FavoriteSchema>;

export const SETTINGS_VERSION = 1;

export const ProjectPathSchema = z.string().min(1).max(1000);

export const DeviceSettingsSchema = z.object({
  version: z.literal(SETTINGS_VERSION),
  deviceId: DeviceIdSchema,
  deviceName: z.string().trim().min(1).max(80),
  theme: z.enum(THEMES),
  language: z.string().min(2).max(16),
  /** null — папка проектов по умолчанию. */
  projectsFolder: z.string().min(1).nullable(),
  favorites: z.array(FavoriteSchema).max(200),
  /** Проекты вне папки проектов: полные пути папок «Название.doska». */
  projectPaths: z.array(ProjectPathSchema).max(200),
});
export type DeviceSettings = z.infer<typeof DeviceSettingsSchema>;

/**
 * Разбор с заменой битых полей значениями по умолчанию: испорченная тема не должна
 * сбрасывать id устройства (иначе в проектах появится «новое» устройство).
 */
export function parseDeviceSettings(raw: unknown, defaults: DeviceSettings): DeviceSettings {
  const source = typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : {};
  const field = <K extends keyof DeviceSettings>(key: K): DeviceSettings[K] => {
    const parsed = DeviceSettingsSchema.shape[key].safeParse(source[key]);
    return parsed.success ? (parsed.data as DeviceSettings[K]) : defaults[key]; // схема поля K
  };
  const favorites = Array.isArray(source.favorites)
    ? source.favorites.flatMap((item: unknown) => {
        const parsed = FavoriteSchema.safeParse(item);
        return parsed.success ? [parsed.data] : [];
      })
    : defaults.favorites;
  const projectPaths = Array.isArray(source.projectPaths)
    ? source.projectPaths.filter(
        (item: unknown): item is string => ProjectPathSchema.safeParse(item).success,
      )
    : defaults.projectPaths;
  return {
    version: SETTINGS_VERSION,
    deviceId: field('deviceId'),
    deviceName: field('deviceName'),
    theme: field('theme'),
    language: field('language'),
    projectsFolder: field('projectsFolder'),
    favorites,
    projectPaths,
  };
}

/** Камера доски, запомненная на устройстве (масштаб и позиция при следующем открытии). */
export const SavedCameraSchema = z.object({
  offsetX: z.number().min(-1e9).max(1e9),
  offsetY: z.number().min(-1e9).max(1e9),
  zoom: z.number().positive().max(100),
});
export type SavedCamera = z.infer<typeof SavedCameraSchema>;
