import type { BoardElement, ElementId, MindMapDirection } from '../../core';
import { t, type TranslationKey } from '../../i18n';
import type { MenuEntry } from '../../ui';
import { mark } from './connectionMenu';
import { action } from './menuAction';
import {
  addMindMapBranch,
  canJoinMindMap,
  colorMindMapBranch,
  mindMapNode,
} from './mindMapActions';
import type { BoardModel } from './model';

const DIRECTIONS: readonly (readonly [MindMapDirection, TranslationKey])[] = [
  ['right', 'mindMap.directionRight'],
  ['both', 'mindMap.directionBoth'],
  ['down', 'mindMap.directionDown'],
];

function rootEntries(model: BoardModel, id: ElementId, direction: MindMapDirection): MenuEntry[] {
  return [
    ...DIRECTIONS.map(([value, label]): MenuEntry => ({
      kind: 'action',
      id: `mindMap-${value}`,
      label: mark(direction === value, t(label)),
      onSelect: () => {
        model.run({ kind: 'setMindMapDirection', rootId: id, direction: value });
      },
    })),
    action('mindMap-dissolve', 'mindMap.dissolve', () => {
      model.run({ kind: 'dissolveMindMap', rootId: id });
    }),
  ];
}

function branchEntries(model: BoardModel, id: ElementId, offset: boolean, leaf: boolean) {
  return [
    ...(offset
      ? [
          action('mindMap-reset', 'mindMap.resetOffset', () => {
            model.run({ kind: 'setMindMapOffset', elementId: id, offset: null });
          }),
        ]
      : []),
    leaf
      ? action('mindMap-remove', 'mindMap.remove', () => {
          model.run({ kind: 'removeFromMindMap', elementId: id });
        })
      : action('mindMap-detach', 'mindMap.detach', () => {
          model.run({ kind: 'detachMindMapBranch', elementId: id });
        }),
  ];
}

/** Пункты майнд-карты для одной карточки: начать карту или управлять узлом. */
export function mindMapEntries(model: BoardModel, element: BoardElement): MenuEntry[] {
  const node = mindMapNode(model, element.id);
  const heading: MenuEntry = { kind: 'heading', id: 'mindMap', label: t('mindMap.heading') };
  const end: MenuEntry = { kind: 'separator', id: 'mindMap-end' };
  if (node === null) {
    if (!canJoinMindMap(element) || element.parentId !== null) return [];
    const makeRoot = action('mindMap-root', 'mindMap.makeRoot', () => {
      model.run({ kind: 'makeMindMapRoot', elementId: element.id });
    });
    return [heading, makeRoot, end];
  }
  const leaf = node.children.length === 0;
  const add = (relation: 'child' | 'sibling') => () => {
    addMindMapBranch(model, element.id, relation);
  };
  const collapse = action(
    'mindMap-collapse',
    node.link.collapsed ? 'mindMap.expand' : 'mindMap.collapse',
    () => {
      model.run({
        kind: 'setMindMapCollapsed',
        elementId: element.id,
        collapsed: !node.link.collapsed,
      });
    },
  );
  return [
    heading,
    action('mindMap-child', 'mindMap.addChild', add('child'), { hotkey: 'mindMapChild' }),
    action('mindMap-sibling', 'mindMap.addSibling', add('sibling'), { hotkey: 'editText' }),
    ...(leaf ? [] : [collapse]),
    ...(leaf
      ? []
      : [
          action('mindMap-color', 'mindMap.colorBranch', () => {
            colorMindMapBranch(model, element.id);
          }),
        ]),
    ...(node.parentId === null
      ? rootEntries(model, element.id, node.link.direction ?? 'right')
      : branchEntries(model, element.id, node.link.offset !== null, leaf)),
    end,
  ];
}
