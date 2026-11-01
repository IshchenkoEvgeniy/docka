import { useMemo, useState } from 'react';
import {
  OverviewCanvas,
  Viewport,
  intersects,
  useCamera,
  useCameraControls,
  useDetailLevel,
  useRenderRect,
  type CameraControls,
  type DetailLevel,
} from '../../canvas';
import { t } from '../../i18n';
import { runAutoBenchmark, type BenchmarkResult } from './autoBenchmark';
import {
  CARD_MAX_HEIGHT,
  cardsBounds,
  generateCards,
  toOverviewItems,
  type BenchmarkCard,
} from './benchmarkCards';
import { BenchmarkCardView } from './BenchmarkCardView';
import { useFps } from './useFps';
import styles from './CanvasBenchmark.module.css';

const CARD_COUNT = 1000;
const PHASES = ['pan', 'zoom', 'overview'] as const;

function ResultTable({ result }: { result: BenchmarkResult }) {
  const rows = [
    { key: 'total', label: t('benchmark.phaseTotal'), stats: result.total },
    ...PHASES.map((phase) => ({
      key: phase,
      label: t(`benchmark.phase.${phase}`),
      stats: result.phases[phase],
    })),
  ];
  return (
    <table className={styles.results}>
      <thead>
        <tr>
          <th>{t('benchmark.phaseColumn')}</th>
          <th>{t('benchmark.averageFps')}</th>
          <th>{t('benchmark.lowFps')}</th>
          <th>{t('benchmark.worstFrame')}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.key}>
            <td>{row.label}</td>
            <td>{row.stats.averageFps}</td>
            <td>{row.stats.lowFps}</td>
            <td>{row.stats.worstFrameMs}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function BenchmarkPanel({
  controls,
  onRun,
  running,
  result,
}: {
  controls: CameraControls;
  onRun: () => void;
  running: boolean;
  result: BenchmarkResult | null;
}) {
  const fps = useFps();
  const camera = useCamera(controls);
  return (
    <aside className={styles.panel}>
      <h2 className={styles.panelTitle}>{t('benchmark.title')}</h2>
      <dl className={styles.metrics}>
        <dt>{t('benchmark.fps')}</dt>
        <dd>{fps}</dd>
        <dt>{t('benchmark.zoom')}</dt>
        <dd>{Math.round(camera.zoom * 100)}%</dd>
        <dt>{t('benchmark.cards')}</dt>
        <dd>{CARD_COUNT}</dd>
      </dl>
      <button className={styles.runButton} type="button" onClick={onRun} disabled={running}>
        {running ? t('benchmark.running') : t('benchmark.run')}
      </button>
      {result !== null && <ResultTable result={result} />}
      <p className={styles.hint}>{t('benchmark.hint')}</p>
    </aside>
  );
}

/** Рендерит DOM-карточки только рядом с экраном и только в детальном виде. */
function VisibleCards({
  controls,
  cards,
  detail,
}: {
  controls: CameraControls;
  cards: readonly BenchmarkCard[];
  detail: DetailLevel;
}) {
  const renderRect = useRenderRect(controls);
  if (renderRect === null || detail === 'compact') return null;
  return cards
    .filter((card) =>
      intersects(renderRect, { x: card.x, y: card.y, width: card.width, height: CARD_MAX_HEIGHT }),
    )
    .map((card) => <BenchmarkCardView key={card.id} card={card} />);
}

/** Прототип холста для шага 0.4: 1000 карточек, пан и зум, счётчик FPS и автозамер. */
export function CanvasBenchmark() {
  const cards = useMemo(() => generateCards(CARD_COUNT), []);
  const overviewItems = useMemo(() => toOverviewItems(cards), [cards]);
  const controls = useCameraControls({ offsetX: 24, offsetY: 24, zoom: 1 });
  const detail = useDetailLevel(controls, true);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<BenchmarkResult | null>(null);

  const run = (): void => {
    const container = controls.containerRef.current;
    if (container === null) return;
    setRunning(true);
    const view = { width: container.clientWidth, height: container.clientHeight };
    void runAutoBenchmark(controls.controller, view, cardsBounds(cards)).then((benchmark) => {
      setResult(benchmark);
      setRunning(false);
    });
  };

  return (
    <div className={styles.root}>
      <Viewport
        controls={controls}
        underlay={
          <OverviewCanvas controls={controls} items={overviewItems} active={detail === 'compact'} />
        }
      >
        <VisibleCards controls={controls} cards={cards} detail={detail} />
      </Viewport>
      <BenchmarkPanel controls={controls} onRun={run} running={running} result={result} />
    </div>
  );
}
