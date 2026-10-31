import { isTauri } from '@tauri-apps/api/core';

/** Приложение запущено в Tauri (а не просто в браузере при разработке). */
export function isTauriRuntime(): boolean {
  return isTauri();
}

/** Телефон или планшет: другой интерфейс и опрос папки вместо слежения. */
export function isMobileDevice(): boolean {
  return /Android|iPhone|iPad/i.test(navigator.userAgent);
}
