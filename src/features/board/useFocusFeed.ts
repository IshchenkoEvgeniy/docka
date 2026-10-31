import { useEffect } from 'react';
import type { CameraControls } from '../../canvas';
import type { BoardModel } from './model';
import { focusElement } from './view';

/** Переход к элементу из поиска: доска показывает его в центре и выделяет. */
export function useFocusFeed(model: BoardModel, controls: CameraControls): void {
  useEffect(() => {
    const feed = model.host.focus;
    if (feed === null) return undefined;
    const consume = (): void => {
      const id = feed.take(model.boardId);
      if (id !== null) focusElement(model, controls, id);
    };
    // После «показать всё» или запомненной камеры (они тоже ставятся в следующем кадре).
    const frame = requestAnimationFrame(() => requestAnimationFrame(consume));
    const unsubscribe = feed.subscribe(consume);
    return () => {
      cancelAnimationFrame(frame);
      unsubscribe();
    };
  }, [model, controls]);
}
