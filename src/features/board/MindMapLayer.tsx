import { useSyncExternalStore } from 'react';
import { CONTROL_ATTRIBUTE, mindMapBranches, useInteraction, type Rect } from '../../canvas';
import type { BoardElement, ElementId } from '../../core';
import { t } from '../../i18n';
import { Icon, inkColor } from '../../ui';
import type { BoardModel } from './model';
import type { MindMapSnapshot } from './mindMapView';
import { previewRect, type Preview } from './previewRect';
import styles from './MindMap.module.css';

function useMindMapState(model: BoardModel) {
  const elements = useSyncExternalStore(model.elements.subscribe, model.elements.getSnapshot);
  const maps = useSyncExternalStore(model.mindMaps.subscribe, model.mindMaps.getSnapshot);
  const drag = useInteraction(model.interaction, (state) => state.drag);
  const resize = useInteraction(model.interaction, (state) => state.resize);
  const preview: Preview = { drag, resize };
  const rectOf = (id: string): Rect | null => previewRect(elements, id, preview);
  return { elements, maps, rectOf };
}

/** Линии ветвей майнд-карт: под карточками, как стрелки (ADR 0011). */
export function MindMapLines({ model }: { readonly model: BoardModel }) {
  const { elements, maps, rectOf } = useMindMapState(model);
  if (maps.forest.nodes.size === 0) return null;
  const branches = mindMapBranches(elements, rectOf);
  return (
    <svg className={styles.lines} aria-hidden="true">
      {branches.map((branch) => (
        <path
          key={branch.childId}
          className={styles.branch}
          d={branch.path}
          style={{ color: inkColor(branch.color) }}
        />
      ))}
    </svg>
  );
}

interface Toggle {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  readonly collapsed: boolean;
  readonly hiddenCount: number;
}

/** Кнопка — с той стороны узла, куда растут его ветки. */
function togglesOf(
  elements: ReadonlyMap<string, BoardElement>,
  maps: MindMapSnapshot,
  rectOf: (id: string) => Rect | null,
): Toggle[] {
  const toggles: Toggle[] = [];
  for (const node of maps.forest.nodes.values()) {
    const rect = rectOf(node.id);
    if (node.children.length === 0 || rect === null || !elements.has(node.id)) continue;
    const down = maps.forest.nodes.get(node.rootId)?.link.direction === 'down';
    // Ветки растут от корня: узел левее корня — кнопка слева (и у свёрнутого, без видимых детей).
    const root = rectOf(node.rootId);
    const left = !down && root !== null && rect.x + rect.width / 2 < root.x + root.width / 2;
    const x = down ? rect.x + rect.width / 2 : left ? rect.x : rect.x + rect.width;
    const y = down ? rect.y + rect.height : rect.y + rect.height / 2;
    const hiddenCount = node.link.collapsed
      ? node.children.reduce((sum, id) => sum + 1 + descendants(maps, id), 0)
      : 0;
    toggles.push({ id: node.id, x, y, collapsed: node.link.collapsed, hiddenCount });
  }
  return toggles;
}

function descendants(maps: MindMapSnapshot, id: string): number {
  const node = maps.forest.nodes.get(id);
  return node === undefined
    ? 0
    : node.children.reduce((sum, child) => sum + 1 + descendants(maps, child), 0);
}

/** Кнопки сворачивания веток: над карточками; число — сколько карточек скрыто. */
export function MindMapToggles({ model }: { readonly model: BoardModel }) {
  const { elements, maps, rectOf } = useMindMapState(model);
  const toggles = maps.forest.nodes.size === 0 ? [] : togglesOf(elements, maps, rectOf);
  return toggles.map((toggle) => (
    <button
      key={toggle.id}
      type="button"
      {...{ [CONTROL_ATTRIBUTE]: '' }}
      className={styles.toggle}
      style={{
        transform: `translate(${String(toggle.x)}px, ${String(toggle.y)}px) translate(-50%, -50%)`,
      }}
      aria-label={
        toggle.collapsed
          ? t('mindMap.expandCount', { count: toggle.hiddenCount })
          : t('mindMap.collapse')
      }
      aria-expanded={!toggle.collapsed}
      onClick={() => {
        model.run({
          kind: 'setMindMapCollapsed',
          elementId: toggle.id as ElementId, // id узла из снимка доски
          collapsed: !toggle.collapsed,
        });
      }}
    >
      {toggle.collapsed ? String(toggle.hiddenCount) : <Icon name="minus" size={14} />}
    </button>
  ));
}
