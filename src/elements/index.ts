/**
 * Типы элементов доски: по папке на тип, регистрация в registry.ts. Импорт извне — только через index.ts папки элемента.
 */
export { definitionFor, elementTypes, isKnownType } from './registry';
export type { ElementData, ElementDefinition, ElementViewProps, RegisteredElement } from './types';
export { ElementRuntimeContext } from './runtime';
export type { BoardDirectory, ElementRuntime } from './runtime';
export { FullscreenEditor, TEXT_EDIT_ORIGIN } from './text';
export { imageAsset, useAsset } from './image';
export { compareInColumn } from './column';
