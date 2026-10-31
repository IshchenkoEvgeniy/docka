import { memo, useMemo } from 'react';
import type { BoardElement } from '../core';
import { ElementPlaceholder } from './ElementPlaceholder';
import type { ElementData, ElementDefinition, RegisteredElement } from './types';

/** Регистрирует тип: битые данные из файла показываются заглушкой, а не роняют доску. */
export function defineElement<D extends ElementData>(
  definition: ElementDefinition<D>,
): RegisteredElement {
  const { View, dataSchema, toRichText, reference } = definition;
  const parse = (data: Readonly<Record<string, unknown>>): D | null => {
    const parsed = dataSchema.safeParse(data);
    return parsed.success ? parsed.data : null;
  };
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
  const { Viewer } = definition;
  const RenderViewer =
    Viewer === undefined
      ? null
      : memo(function RenderViewer({ element }: { readonly element: BoardElement }) {
          const parsed = useMemo(() => dataSchema.safeParse(element.data), [element.data]);
          if (!parsed.success) return <ElementPlaceholder reason="broken" />;
          return <Viewer element={element} data={parsed.data} editing={false} />;
        });
  return {
    type: definition.type,
    defaultSize: definition.defaultSize,
    minSize: definition.minSize,
    resize: definition.resize,
    richText: definition.richText,
    activate: definition.activate,
    container: definition.container ?? false,
    editOnCreate: definition.editOnCreate ?? definition.activate === 'edit',
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
    target: (element) => {
      const data = parse(element.data);
      return data === null || definition.target === undefined ? null : definition.target(data);
    },
    entityOf: (raw) => {
      const data = parse(raw);
      return data === null || reference === undefined ? null : reference.entityId(data);
    },
    withEntity: (raw, entityId) => {
      const data = parse(raw);
      return data === null || reference === undefined ? null : reference.withEntity(data, entityId);
    },
    menuActions: (element) => {
      const data = parse(element.data);
      return data === null || definition.menuActions === undefined
        ? []
        : definition.menuActions(data);
    },
    Viewer: RenderViewer,
    fromPastedText: definition.fromPastedText ?? null,
    fromFile: definition.fromFile ?? null,
    enrich:
      definition.enrich === undefined
        ? null
        : async (raw, tools) => {
            const data = parse(raw);
            return data === null || definition.enrich === undefined
              ? null
              : definition.enrich(data, tools);
          },
  };
}
