import { useMemo } from 'react';
import { useInteraction } from '../../canvas';
import { FullscreenEditor, type ElementRuntime } from '../../elements';
import { fullscreenFragment } from './fullscreenText';
import type { BoardModel } from './model';

/**
 * Телефон: правка текста на весь экран. Показывается доской, а не карточкой, — карточка может
 * быть не смонтирована (мелкий масштаб, элемент за краем экрана).
 */
export function FullscreenEditing({
  model,
  runtime,
}: {
  readonly model: BoardModel;
  readonly runtime: ElementRuntime;
}) {
  const editingId = useInteraction(model.interaction, (state) => state.editingId);
  const fragment = useMemo(
    () => fullscreenFragment(model, runtime, editingId),
    [editingId, model, runtime],
  );
  if (fragment === null) return null;
  return <FullscreenEditor fragment={fragment} runtime={runtime} />;
}
