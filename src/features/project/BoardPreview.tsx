import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import type * as Y from 'yjs';
import { arrowHead, boundsOf, connectorGeometry, type ConnectorEnd, type Rect } from '../../canvas';
import { compareStacking, type BoardElement, type BoardId, type Endpoint } from '../../core';
import {
  createBoardConnectionsStore,
  createBoardElementsStore,
  type AssetStore,
  type BoardConnectionsStore,
  type BoardElementsStore,
  type OpenProject,
} from '../../data';
import { ElementRuntimeContext, definitionFor, type BoardDirectory } from '../../elements';
import { inkColor } from '../../ui';
import { createPreviewRuntime } from './previewRuntime';
import styles from './Gallery.module.css';

/** Откуда превью берёт данные: доски проекта, файлы, названия вложенных досок. */
export interface PreviewSource {
  readonly project: OpenProject;
  readonly assets: AssetStore | null;
  readonly boards: BoardDirectory | null;
}

/** Мельче этого превью не уменьшает (иначе одна карточка на пустой доске — точка). */
const MAX_SCALE = 0.6;
const PADDING = 24;

interface Stores {
  readonly doc: Y.Doc;
  readonly elements: BoardElementsStore;
  readonly connections: BoardConnectionsStore;
}

/** Документ доски открывается, только когда плитка появилась на экране. */
function usePreviewStores(source: PreviewSource, boardId: BoardId, visible: boolean) {
  const [stores, setStores] = useState<Stores | null>(null);
  useEffect(() => {
    if (!visible) return undefined;
    let created: Stores | null = null;
    let cancelled = false;
    source.project.openBoard(boardId).then(
      (document) => {
        if (cancelled) return;
        created = {
          doc: document.doc,
          elements: createBoardElementsStore(document.doc),
          connections: createBoardConnectionsStore(document.doc),
        };
        setStores(created);
      },
      (error: unknown) => {
        console.error('Превью доски не открылось', error);
      },
    );
    return () => {
      cancelled = true;
      created?.elements.destroy();
      created?.connections.destroy();
    };
  }, [source, boardId, visible]);
  return stores;
}

function useVisible(ref: React.RefObject<HTMLDivElement | null>): boolean {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const node = ref.current;
    if (node === null || visible) return undefined;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) setVisible(true);
    });
    observer.observe(node);
    return () => {
      observer.disconnect();
    };
  }, [ref, visible]);
  return visible;
}

function useBoxSize(ref: React.RefObject<HTMLDivElement | null>) {
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);
  useEffect(() => {
    const node = ref.current;
    if (node === null) return undefined;
    const observer = new ResizeObserver(() => {
      setSize({ width: node.clientWidth, height: node.clientHeight });
    });
    observer.observe(node);
    return () => {
      observer.disconnect();
    };
  }, [ref]);
  return size;
}

function endOf(elements: ReadonlyMap<string, BoardElement>, end: Endpoint): ConnectorEnd | null {
  if (end.kind === 'point') return { kind: 'point', point: end };
  const element = elements.get(end.elementId);
  if (element === undefined) return null;
  const parent = element.parentId === null ? undefined : elements.get(element.parentId);
  return { kind: 'rect', rect: parent ?? element, side: end.side };
}

function PreviewConnections({ stores, bounds }: { stores: Stores; bounds: Rect }) {
  const elements = useSyncExternalStore(stores.elements.subscribe, stores.elements.getSnapshot);
  const connections = useSyncExternalStore(
    stores.connections.subscribe,
    stores.connections.getSnapshot,
  );
  const lines = [...connections.values()].flatMap((connection) => {
    const from = endOf(elements, connection.from);
    const to = endOf(elements, connection.to);
    if (from === null || to === null) return [];
    const geometry = connectorGeometry(from, to, connection.lineStyle);
    return [{ connection, geometry }];
  });
  return (
    <svg
      className={styles.previewLines}
      viewBox={`${String(bounds.x)} ${String(bounds.y)} ${String(bounds.width)} ${String(bounds.height)}`}
      style={{ width: bounds.width, height: bounds.height }}
      aria-hidden="true"
    >
      {lines.map(({ connection, geometry }) => (
        <g key={connection.id} style={{ color: inkColor(connection.color) }}>
          <path d={geometry.path} />
          {connection.endMarker === 'arrow' && (
            <path
              className={styles.previewHead}
              d={arrowHead(geometry.end, geometry.endAngle, 12)}
            />
          )}
        </g>
      ))}
    </svg>
  );
}

function PreviewItem({ element }: { readonly element: BoardElement }) {
  const { Render, resize } = definitionFor(element.type);
  return (
    <div
      className={styles.previewItem}
      style={{
        transform: `translate(${String(element.x)}px, ${String(element.y)}px)`,
        width: element.width,
        ...(resize === 'width' ? { minHeight: element.height } : { height: element.height }),
      }}
    >
      <Render element={element} editing={false} />
    </div>
  );
}

function PreviewContent({
  stores,
  source,
  box,
}: {
  readonly stores: Stores;
  readonly source: PreviewSource;
  readonly box: { width: number; height: number };
}) {
  const elements = useSyncExternalStore(stores.elements.subscribe, stores.elements.getSnapshot);
  const runtime = useMemo(
    () => createPreviewRuntime({ ...source, doc: stores.doc, elements: stores.elements }),
    [source, stores],
  );
  const topLevel = useMemo(
    () =>
      [...elements.values()]
        .filter((element) => element.parentId === null || !elements.has(element.parentId))
        .sort(compareStacking),
    [elements],
  );
  const bounds = boundsOf(topLevel);
  if (bounds === null) return null;
  const framed = {
    x: bounds.x - PADDING,
    y: bounds.y - PADDING,
    width: bounds.width + PADDING * 2,
    height: bounds.height + PADDING * 2,
  };
  const scale = Math.min(box.width / framed.width, box.height / framed.height, MAX_SCALE);
  const left = (box.width - framed.width * scale) / 2 - framed.x * scale;
  const top = (box.height - framed.height * scale) / 2 - framed.y * scale;
  return (
    <ElementRuntimeContext.Provider value={runtime}>
      <div
        className={styles.previewWorld}
        style={{
          transform: `translate(${String(left)}px, ${String(top)}px) scale(${String(scale)})`,
        }}
      >
        <div style={{ transform: `translate(${String(framed.x)}px, ${String(framed.y)}px)` }}>
          <PreviewConnections stores={stores} bounds={framed} />
        </div>
        {topLevel.map((element) => (
          <PreviewItem key={element.id} element={element} />
        ))}
      </div>
    </ElementRuntimeContext.Provider>
  );
}

/** Уменьшенная доска: те же карточки, что на холсте, вписанные в плитку. */
export function BoardPreview({
  source,
  boardId,
  onCount,
}: {
  readonly source: PreviewSource;
  readonly boardId: BoardId;
  /** Сколько карточек на доске (известно после загрузки). */
  readonly onCount: (count: number) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const visible = useVisible(ref);
  const box = useBoxSize(ref);
  const stores = usePreviewStores(source, boardId, visible);
  const count = useSyncExternalStore(
    stores?.elements.subscribe ?? noSubscribe,
    () => stores?.elements.getSnapshot().size ?? null,
  );
  useEffect(() => {
    if (count !== null) onCount(count);
  }, [count, onCount]);
  return (
    <div ref={ref} className={styles.preview} aria-hidden="true">
      {stores !== null && box !== null && (
        <PreviewContent stores={stores} source={source} box={box} />
      )}
    </div>
  );
}

const noSubscribe = (): (() => void) => () => undefined;
