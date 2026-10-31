import { open } from '@tauri-apps/plugin-dialog';

/** Системный выбор папки (компьютер). null — пользователь передумал. */
export async function pickFolder(title: string): Promise<string | null> {
  const picked = await open({ directory: true, multiple: false, title });
  return typeof picked === 'string' ? picked : null;
}
