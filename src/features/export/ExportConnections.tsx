import { arrowHead, connectorGeometry, type Point } from '../../canvas';
import type { Connection } from '../../core';
import { inkColor } from '../../ui';
import { exportEnd, type ExportPlan } from './plan';
import styles from './Export.module.css';

function Marker({
  kind,
  tip,
  angle,
}: {
  kind: Connection['endMarker'];
  tip: Point;
  angle: number;
}) {
  if (kind === 'arrow') return <path className={styles.head} d={arrowHead(tip, angle, 12)} />;
  if (kind === 'dot') return <circle className={styles.head} cx={tip.x} cy={tip.y} r={4} />;
  return null;
}

export function ExportConnections({ plan }: { readonly plan: ExportPlan }) {
  const lines = plan.connections.flatMap((connection) => {
    const from = exportEnd(plan.geometryElements, connection.from);
    const to = exportEnd(plan.geometryElements, connection.to);
    if (from === null || to === null) return [];
    return [{ connection, geometry: connectorGeometry(from, to, connection.lineStyle) }];
  });
  return (
    <>
      <svg className={styles.lines} aria-hidden="true">
        {lines.map(({ connection, geometry }) => (
          <g key={connection.id} style={{ color: inkColor(connection.color) }}>
            <path d={geometry.path} />
            <Marker
              kind={connection.startMarker}
              tip={geometry.start}
              angle={geometry.startAngle}
            />
            <Marker kind={connection.endMarker} tip={geometry.end} angle={geometry.endAngle} />
          </g>
        ))}
      </svg>
      {lines
        .filter(({ connection }) => connection.label !== '')
        .map(({ connection, geometry }) => (
          <div
            key={connection.id}
            data-export-bounds=""
            className={styles.label}
            style={{ left: geometry.middle.x, top: geometry.middle.y }}
          >
            {connection.label}
          </div>
        ))}
    </>
  );
}
