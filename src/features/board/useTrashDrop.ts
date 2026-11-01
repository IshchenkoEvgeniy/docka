import { useEffect, useState, type RefObject } from 'react';
import { useInteraction, type CameraControls } from '../../canvas';
import { deleteSelection } from './boardActions';
import type { BoardModel } from './model';

function inside(node: HTMLElement | null, x: number, y: number): boolean {
  if (node === null) return false;
  const box = node.getBoundingClientRect();
  return x >= box.left && x <= box.right && y >= box.top && y <= box.bottom;
}

/**
 * Корзина как место сброса: пока тянут карточки, следим за указателем (холст захватил
 * его, поэтому слушаем окно). Отпустили над корзиной — перенос отменяется, а выделенное
 * удаляется одним шагом отмены.
 */
export function useTrashDrop(
  model: BoardModel,
  controls: CameraControls,
  trash: RefObject<HTMLButtonElement | null>,
): boolean {
  const dragging = useInteraction(model.interaction, (state) => (state.drag?.ids.size ?? 0) > 0);
  const [over, setOver] = useState(false);
  useEffect(() => {
    if (!dragging) {
      setOver(false);
      return undefined;
    }
    const onMove = (event: PointerEvent): void => {
      setOver(inside(trash.current, event.clientX, event.clientY));
    };
    const onUp = (event: PointerEvent): void => {
      if (!inside(trash.current, event.clientX, event.clientY)) return;
      controls.gestures.cancel();
      deleteSelection(model);
    };
    // Захват: раньше, чем холст получит отпускание и применит перенос.
    window.addEventListener('pointermove', onMove, true);
    window.addEventListener('pointerup', onUp, true);
    return () => {
      window.removeEventListener('pointermove', onMove, true);
      window.removeEventListener('pointerup', onUp, true);
    };
  }, [dragging, model, controls, trash]);
  return over;
}
