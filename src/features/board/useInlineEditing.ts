import { useEffect } from 'react';
import { useInteraction, type CameraControls } from '../../canvas';
import { definitionFor } from '../../elements';
import type { BoardModel } from './model';
import { measureElement } from './view';

/** Телефон остаётся на холсте: показываем редактируемую карточку вместо отдельного окна. */
export function useInlineEditing(model: BoardModel, controls: CameraControls): void {
  const editingId = useInteraction(model.interaction, (state) => state.editingId);
  useEffect(() => {
    if (editingId === null || !window.matchMedia('(max-width: 640px), (pointer: coarse)').matches)
      return undefined;
    const focus = (): void => {
      focusInlineCard(model, controls, editingId);
    };
    focus();
    window.visualViewport?.addEventListener('resize', focus);
    return () => {
      window.visualViewport?.removeEventListener('resize', focus);
    };
  }, [model, controls, editingId]);
}

function focusInlineCard(model: BoardModel, controls: CameraControls, id: string): void {
  const elements = model.elements.getSnapshot();
  const element = elements.get(id);
  const viewport = window.visualViewport;
  const box = controls.containerRef.current?.getBoundingClientRect();
  if (element === undefined || box === undefined) return;
  const top = Math.max(box.top, viewport?.offsetTop ?? box.top);
  const bottom = Math.min(
    box.bottom,
    viewport === null ? box.bottom : viewport.offsetTop + viewport.height,
  );
  if (bottom <= top) return;
  const zoom = Math.max(1, controls.controller.getCamera().zoom);
  const parent = element.parentId === null ? undefined : elements.get(element.parentId);
  const base = parent === undefined ? element : (measureElement(controls, id) ?? parent);
  // У зоны редактируется подпись над границей, а не центр её большой пустой площади.
  const rect = definitionFor(element.type).region
    ? { ...base, y: base.y - 44 / zoom, height: 44 / zoom }
    : base;
  const width = Math.min(rect.width, Math.max(1, box.width - 48) / zoom);
  const height = Math.min(rect.height, Math.max(44, bottom - top - 128) / zoom);
  controls.controller.setCamera({
    zoom,
    offsetX: box.width / 2 - (rect.x + width / 2) * zoom,
    offsetY: (top + bottom) / 2 - box.top - (rect.y + height / 2) * zoom,
  });
}
