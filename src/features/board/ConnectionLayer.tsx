import { useSyncExternalStore } from 'react';
import {
  CONNECTION_ID_ATTRIBUTE,
  arrowHead,
  connectorGeometry,
  useInteraction,
  type ConnectorEnd,
  type ConnectorGeometry,
  type InteractionState,
  type Point,
  type Rect,
} from '../../canvas';
import type { BoardElement, Connection, Endpoint } from '../../core';
import { cx, inkColor } from '../../ui';
import type { BoardModel } from './model';
import { regionConnectionMoves } from './regionMoves';
import styles from './Connections.module.css';

const HEAD_SIZE = 12;

type Preview = Pick<InteractionState, 'drag' | 'resize'>;

/** Прямоугольник элемента с учётом перетаскивания; у карточки в колонке — сама колонка. */
function rectOf(
  elements: ReadonlyMap<string, BoardElement>,
  id: string,
  preview: Preview,
): Rect | null {
  const element = elements.get(id);
  if (element === undefined) return null;
  const parent = element.parentId === null ? undefined : elements.get(element.parentId);
  const target = parent ?? element;
  const base = preview.resize?.id === target.id ? preview.resize.rect : target;
  const drag = preview.drag;
  if (drag?.ids.has(target.id) !== true) return base;
  return { ...base, x: base.x + drag.dx, y: base.y + drag.dy };
}

function endOf(
  elements: ReadonlyMap<string, BoardElement>,
  endpoint: Endpoint,
  preview: Preview,
): ConnectorEnd | null {
  if (endpoint.kind === 'point') return { kind: 'point', point: endpoint };
  const rect = rectOf(elements, endpoint.elementId, preview);
  return rect === null ? null : { kind: 'rect', rect, side: endpoint.side };
}

function Marker({
  kind,
  tip,
  angle,
}: {
  kind: Connection['endMarker'];
  tip: Point;
  angle: number;
}) {
  if (kind === 'arrow')
    return <path className={styles.head} d={arrowHead(tip, angle, HEAD_SIZE)} />;
  if (kind === 'dot') return <circle className={styles.head} cx={tip.x} cy={tip.y} r={4} />;
  return null;
}

function ConnectionShape({
  connection,
  geometry,
  selected,
}: {
  readonly connection: Connection;
  readonly geometry: ConnectorGeometry;
  readonly selected: boolean;
}) {
  const attributes = { [CONNECTION_ID_ATTRIBUTE]: connection.id };
  return (
    <g
      {...attributes}
      className={cx(styles.connection, selected && styles.selected)}
      style={{ color: inkColor(connection.color) }}
    >
      <path className={styles.hit} d={geometry.path} />
      <path className={styles.line} d={geometry.path} />
      <Marker kind={connection.endMarker} tip={geometry.end} angle={geometry.endAngle} />
      <Marker kind={connection.startMarker} tip={geometry.start} angle={geometry.startAngle} />
    </g>
  );
}

/** Проводимая сейчас стрелка (от кружка у элемента к пальцу или курсору). */
function ConnectingPreview({
  model,
  elements,
}: {
  readonly model: BoardModel;
  readonly elements: ReadonlyMap<string, BoardElement>;
}) {
  const connecting = useInteraction(model.interaction, (state) => state.connecting);
  if (connecting === null) return null;
  const noPreview: Preview = { drag: null, resize: null };
  const from = rectOf(elements, connecting.from, noPreview);
  if (from === null) return null;
  const hovered =
    connecting.hoverId === null ? null : rectOf(elements, connecting.hoverId, noPreview);
  const to: ConnectorEnd =
    hovered === null
      ? { kind: 'point', point: connecting.to }
      : { kind: 'rect', rect: hovered, side: 'auto' };
  const geometry = connectorGeometry({ kind: 'rect', rect: from, side: 'auto' }, to, 'curved');
  return (
    <g className={cx(styles.connection, styles.preview)}>
      <path className={styles.line} d={geometry.path} />
      <Marker kind="arrow" tip={geometry.end} angle={geometry.endAngle} />
    </g>
  );
}

/** Стрелки доски: SVG под элементами и подписи над ними, всё в мировых координатах. */
export function ConnectionLayer({ model }: { readonly model: BoardModel }) {
  const connections = useSyncExternalStore(
    model.connections.subscribe,
    model.connections.getSnapshot,
  );
  const elements = useSyncExternalStore(model.elements.subscribe, model.elements.getSnapshot);
  const drag = useInteraction(model.interaction, (state) => state.drag);
  const resize = useInteraction(model.interaction, (state) => state.resize);
  const selection = useInteraction(model.interaction, (state) => state.connectionSelection);
  const preview: Preview = { drag, resize };
  const moving =
    drag === null
      ? []
      : [...drag.ids].flatMap((id) => {
          const element = elements.get(id);
          return element === undefined
            ? []
            : [{ id, x: element.x + drag.dx, y: element.y + drag.dy }];
        });
  const endpoints = new Map(
    regionConnectionMoves(elements, connections.values(), moving).map((item) => [
      item.connectionId,
      item,
    ]),
  );
  const shapes = [...connections.values()].flatMap((connection) => {
    const shifted = endpoints.get(connection.id);
    const from = endOf(elements, shifted?.from ?? connection.from, preview);
    const to = endOf(elements, shifted?.to ?? connection.to, preview);
    if (from === null || to === null) return [];
    return [{ connection, geometry: connectorGeometry(from, to, connection.lineStyle) }];
  });
  return (
    <>
      <svg className={styles.layer} aria-hidden="true">
        {shapes.map(({ connection, geometry }) => (
          <ConnectionShape
            key={connection.id}
            connection={connection}
            geometry={geometry}
            selected={selection.has(connection.id)}
          />
        ))}
        <ConnectingPreview model={model} elements={elements} />
      </svg>
      {shapes
        .filter(({ connection }) => connection.label !== '')
        .map(({ connection, geometry }) => (
          <div
            key={connection.id}
            {...{ [CONNECTION_ID_ATTRIBUTE]: connection.id }}
            className={cx(styles.label, selection.has(connection.id) && styles.labelSelected)}
            style={{
              transform: `translate(${String(geometry.middle.x)}px, ${String(geometry.middle.y)}px) translate(-50%, -50%)`,
            }}
          >
            {connection.label}
          </div>
        ))}
    </>
  );
}
