import type { ElementId, MindMapDirection } from '../model';
import type { NewElement } from './newElement';

/**
 * Команды майнд-карты (ADR 0011). Раскладку после каждой выполняет слой data в той же
 * транзакции: одна команда — один шаг отмены.
 */
export type MindMapCommand =
  /** Обычная карточка на доске становится корнем новой карты. */
  | {
      readonly kind: 'makeMindMapRoot';
      readonly elementId: ElementId;
      readonly direction?: MindMapDirection;
    }
  /** Новая карточка — ветка узла (child) или соседняя (sibling; у корня — тоже ветка). */
  | {
      readonly kind: 'addMindMapNode';
      readonly anchorId: ElementId;
      readonly relation: 'child' | 'sibling';
      readonly element: NewElement;
    }
  /** Существующие карточки (или узлы с ветками) — последними ветками узла parentId. */
  | {
      readonly kind: 'attachToMindMap';
      readonly elementIds: readonly ElementId[];
      readonly parentId: ElementId;
    }
  /** Узел с ветками становится отдельной картой. */
  | { readonly kind: 'detachMindMapBranch'; readonly elementId: ElementId }
  /** Узел становится обычной карточкой, его ветки переходят к его родителю. */
  | { readonly kind: 'removeFromMindMap'; readonly elementId: ElementId }
  /** Вся карта становится обычными карточками на своих местах. */
  | { readonly kind: 'dissolveMindMap'; readonly rootId: ElementId }
  /**
   * В корзину: с ветками (branch) или только узел — ветки переходят к родителю (node);
   * у корня в режиме node остальные карточки карты становятся обычными.
   */
  | {
      readonly kind: 'deleteMindMapNode';
      readonly elementId: ElementId;
      readonly mode: 'branch' | 'node';
    }
  | {
      readonly kind: 'setMindMapCollapsed';
      readonly elementId: ElementId;
      readonly collapsed: boolean;
    }
  | {
      readonly kind: 'setMindMapDirection';
      readonly rootId: ElementId;
      readonly direction: MindMapDirection;
    }
  /** Ручной сдвиг узла с веткой; null — вернуть на место раскладки. */
  | {
      readonly kind: 'setMindMapOffset';
      readonly elementId: ElementId;
      readonly offset: { readonly dx: number; readonly dy: number } | null;
    };

export type MindMapCommandKind = MindMapCommand['kind'];

const MIND_MAP_KINDS: ReadonlySet<string> = new Set<MindMapCommandKind>([
  'makeMindMapRoot',
  'addMindMapNode',
  'attachToMindMap',
  'detachMindMapBranch',
  'removeFromMindMap',
  'dissolveMindMap',
  'deleteMindMapNode',
  'setMindMapCollapsed',
  'setMindMapDirection',
  'setMindMapOffset',
]);

/** Команда карты среди команд доски. */
export function isMindMapCommand(command: { readonly kind: string }): command is MindMapCommand {
  return MIND_MAP_KINDS.has(command.kind);
}
