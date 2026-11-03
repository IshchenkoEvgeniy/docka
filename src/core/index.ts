/**
 * Домен: типы, zod-схемы, команды и порты (интерфейсы). Не зависит ни от чего в проекте:
 * ни от React, ни от Yjs, ни от Tauri, ни от DOM.
 */
export * from './commands';
export * from './mindMap';
export * from './model';
export * from './ports';
export { err, ok } from './result';
export type { Result } from './result';
export * from './search';
