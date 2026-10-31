import { useEffect } from 'react';
import { useTags } from '../../elements';
import { computeHighlight } from './highlight';
import type { BoardModel } from './model';

/** Пересчитывает подсветку, когда меняются фильтр, поиск, элементы или теги. */
export function HighlightSync({ model }: { readonly model: BoardModel }) {
  const tags = useTags();
  useEffect(() => {
    const update = (): void => {
      model.interaction.setState({ highlight: computeHighlight(model, tags) });
    };
    update();
    const stopSettings = model.settings.subscribe(update);
    const stopElements = model.elements.subscribe(update);
    return () => {
      stopSettings();
      stopElements();
      model.interaction.setState({ highlight: null });
    };
  }, [model, tags]);
  return null;
}
