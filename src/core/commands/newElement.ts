import type { ColorName, ElementId, MindMapPlacement, RichNode, TagId } from '../model';

export interface ElementPlacement {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/** Описание нового элемента (одного или из пачки — например, при вставке). */
export interface NewElement {
  readonly type: string;
  readonly placement: ElementPlacement;
  readonly color?: ColorName;
  readonly parentId?: ElementId | null;
  /** Контейнер из этой же пачки (номер в списке, раньше этого элемента): вставка колонки с карточками. */
  readonly parentIndex?: number;
  readonly locked?: boolean;
  readonly tagIds?: readonly TagId[];
  readonly data: Readonly<Record<string, unknown>>;
  /** Узел майнд-карты; parentIndex — номер в этой же пачке (в любом месте списка). */
  readonly mindMap?: MindMapPlacement;
  /** Форматированный текст (заметка, заголовок): ляжет в Yjs отдельным полем `text`. */
  readonly richText?: readonly RichNode[];
}
