import { createEmitter } from './emitter';
import { UNDO_LIMIT, type UndoHistory } from './undo';

/** Общая история: batch склеивает шаги разных документов в один шаг отмены. */
export interface CombinedUndoHistory extends UndoHistory {
  readonly batch: (action: () => void) => void;
}

/** Шаг общей истории — номера частей, в которых он записан. */
type Step = number[];

/** Убирает из очереди последний шаг части (её отменили напрямую, мимо общей истории). */
function forget(order: Step[], index: number): void {
  for (let position = order.length - 1; position >= 0; position -= 1) {
    const step = order[position];
    const at = step?.lastIndexOf(index) ?? -1;
    if (step === undefined || at < 0) continue;
    step.splice(at, 1);
    if (step.length === 0) order.splice(position, 1);
    return;
  }
}

/** Шаг из одной очереди в другую; шаги, вытесненные из истории части, пропускаются. */
function replay(parts: readonly UndoHistory[], from: Step[], to: Step[], undo: boolean): boolean {
  for (let step = from.pop(); step !== undefined; step = from.pop()) {
    const order = undo ? [...step].reverse() : step;
    const done = order.filter((index) => {
      const part = parts[index];
      return part !== undefined && (undo ? part.undo() : part.redo());
    });
    if (done.length > 0) {
      to.push(step);
      return true;
    }
  }
  return false;
}

/** Очереди шагов общей истории: какой части принадлежит каждый шаг отмены и повтора. */
function createStepOrder() {
  const undoOrder: Step[] = [];
  const redoOrder: Step[] = [];
  let batch: Step | null = null;
  return {
    undoOrder,
    redoOrder,
    /** Новая правка в части index; обрывает цепочку повторов. */
    record: (index: number): void => {
      if (batch !== null) batch.push(index);
      else undoOrder.push([index]);
      if (undoOrder.length > UNDO_LIMIT) undoOrder.shift();
      redoOrder.length = 0;
    },
    batch: (action: () => void): void => {
      const collected: Step = [];
      batch = collected;
      try {
        action();
      } finally {
        batch = null;
        if (collected.length > 0) undoOrder.push(collected);
      }
    },
  };
}

/**
 * Одна история отмены для нескольких документов (ADR 0004): на доске правки сущностей
 * (документ проекта) и доски отменяются по порядку, как одна история.
 * Части не уничтожаются вместе с общей историей — ими владеют другие.
 */
export function combineUndoHistories(parts: readonly UndoHistory[]): CombinedUndoHistory {
  const order = createStepOrder();
  let replaying = false;
  const changed = createEmitter();
  const steps = createEmitter<'undo' | 'redo'>();
  const stops = parts.flatMap((part, index) => [
    part.onStepAdded((stack) => {
      if (replaying) return;
      if (stack === 'redo') forget(order.undoOrder, index);
      else {
        order.record(index);
        steps.emit(stack);
      }
    }),
    part.subscribe(changed.emit),
  ]);
  const run = (undo: boolean): boolean => {
    replaying = true;
    try {
      const { undoOrder, redoOrder } = order;
      return undo
        ? replay(parts, undoOrder, redoOrder, true)
        : replay(parts, redoOrder, undoOrder, false);
    } finally {
      replaying = false;
      changed.emit();
    }
  };
  return {
    undo: () => run(true),
    redo: () => run(false),
    canUndo: () => order.undoOrder.length > 0,
    canRedo: () => order.redoOrder.length > 0,
    subscribe: changed.subscribe,
    onStepAdded: steps.subscribe,
    batch: order.batch,
    destroy: () => {
      stops.forEach((stop) => {
        stop();
      });
      changed.clear();
      steps.clear();
    },
  };
}
