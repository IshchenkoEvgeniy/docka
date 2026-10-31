import { memo, useMemo } from 'react';
import type { BoardElement } from '../core';
import { ElementPlaceholder } from './ElementPlaceholder';
import type { ElementData, ElementDefinition, RegisteredElement } from './types';

/** Регистрирует тип: битые данные из файла показываются заглушкой, а не роняют доску. */
export function defineElement<D extends ElementData>(
  definition: ElementDefinition<D>,
): RegisteredElement {
  const { View, dataSchema, toRichText } = definition;
  const Render = memo(function Render({
    element,
    editing,
  }: {
    readonly element: BoardElement;
    readonly editing: boolean;
  }) {
    const parsed = useMemo(() => dataSchema.safeParse(element.data), [element.data]);
    if (!parsed.success) return <ElementPlaceholder reason="broken" />;
    return <View element={element} data={parsed.data} editing={editing} />;
  });
  return {
    type: definition.type,
    defaultSize: definition.defaultSize,
    minSize: definition.minSize,
    resize: definition.resize,
    richText: definition.richText,
    activate: definition.activate,
    container: definition.container ?? false,
    createData: definition.createData,
    Render,
    toPlainText: (element, rich) => {
      const parsed = dataSchema.safeParse(element.data);
      return parsed.success ? definition.toPlainText(parsed.data, rich) : '';
    },
    toRichText: (element, rich) => {
      if (toRichText === undefined) return null;
      const parsed = dataSchema.safeParse(element.data);
      return parsed.success ? toRichText(parsed.data, rich) : rich;
    },
  };
}
