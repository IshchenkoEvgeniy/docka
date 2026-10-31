import * as Y from 'yjs';
import { createEmitter } from './emitter';
import { LOCAL_ORIGIN } from './recordPatch';

/**
 * История отмены одного документа. Отменяются только свои локальные правки:
 * то, что пришло с другого устройства, «Отменить» не трогает.
 * Одна команда = одна транзакция = один шаг. Набор текста (mergeOrigins) склеивается
 * в шаги по паузам, но никогда не склеивается с командами.
 */
export interface UndoHistory {
  readonly undo: () => boolean;
  readonly redo: () => boolean;
  readonly canUndo: () => boolean;
  readonly canRedo: () => boolean;
  /** Подписка на изменение доступности отмены/повтора. */
  readonly subscribe: (listener: () => void) => () => void;
  /** Новый шаг: в стек отмены (новая правка или повтор) или в стек повтора (после отмены). */
  readonly onStepAdded: (listener: (stack: 'undo' | 'redo') => void) => () => void;
  readonly destroy: () => void;
}

/** Не меньше 100 шагов на документ (ТЗ, раздел 4). */
export const UNDO_LIMIT = 200;

/** Набор текста без паузы дольше этого — один шаг отмены. */
export const TYPING_MERGE_MS = 700;

export interface UndoOptions {
  /** Источники правок текста (редактор), которые склеиваются по времени. */
  readonly mergeOrigins?: readonly unknown[];
}

export function createUndoHistory(
  doc: Y.Doc,
  rootNames: readonly string[],
  options: UndoOptions = {},
): UndoHistory {
  const scope = rootNames.map((name) => doc.getMap<unknown>(name));
  const merging = new Set(options.mergeOrigins ?? []);
  const manager = new Y.UndoManager(scope, {
    trackedOrigins: new Set<unknown>([LOCAL_ORIGIN, ...merging]),
    captureTimeout: TYPING_MERGE_MS,
  });
  // Любая правка, кроме набора текста, — отдельный шаг: не прилипает к предыдущему и следующему.
  const separate = (transaction: Y.Transaction): void => {
    if (!merging.has(transaction.origin)) manager.stopCapturing();
  };
  doc.on('beforeTransaction', separate);
  doc.on('afterTransaction', separate);
  const changed = createEmitter();
  const steps = createEmitter<'undo' | 'redo'>();
  const notify = (): void => {
    changed.emit();
  };
  const trim = (): void => {
    while (manager.undoStack.length > UNDO_LIMIT) manager.undoStack.shift();
  };
  manager.on('stack-item-added', (event: { type: 'undo' | 'redo' }) => {
    trim();
    steps.emit(event.type);
    notify();
  });
  manager.on('stack-item-popped', notify);
  manager.on('stack-cleared', notify);

  return {
    undo: () => manager.undo() !== null,
    redo: () => manager.redo() !== null,
    canUndo: () => manager.canUndo(),
    canRedo: () => manager.canRedo(),
    subscribe: changed.subscribe,
    onStepAdded: steps.subscribe,
    destroy: () => {
      doc.off('beforeTransaction', separate);
      doc.off('afterTransaction', separate);
      manager.destroy();
      changed.clear();
      steps.clear();
    },
  };
}
