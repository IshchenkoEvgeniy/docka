import { useMemo } from 'react';
import { useInteraction } from '../../canvas';
import { FullscreenEditor, definitionFor, type ElementRuntime } from '../../elements';
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
  const fragment = useMemo(() => {
    if (editingId === null) return null;
    const element = model.elements.getSnapshot().get(editingId);
    if (element === undefined) return null;
    const initial =
      definitionFor(element.type).toRichText(element, model.richTextOf(editingId)) ?? [];
    return runtime.ensureText(editingId, initial);
  }, [editingId, model, runtime]);
  if (!runtime.fullscreenEditing || fragment === null) return null;
  return <FullscreenEditor fragment={fragment} runtime={runtime} />;
}
