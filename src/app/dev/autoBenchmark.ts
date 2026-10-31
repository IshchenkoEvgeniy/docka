import { zoomAt, type Camera, type PanZoomController } from '../../canvas';
import { summarizeFrames, type FrameStats } from './frameStats';

/**
 * Автоматический замер: одинаковый сценарий движения камеры на любом устройстве.
 * Три фазы по 2 секунды: пан при 100 %, зум туда-обратно, пан при обзоре всей доски.
 */

export type BenchmarkPhase = 'pan' | 'zoom' | 'overview';

export interface BenchmarkResult {
  readonly total: FrameStats;
  readonly phases: Readonly<Record<BenchmarkPhase, FrameStats>>;
}

interface Size {
  readonly width: number;
  readonly height: number;
}

const PHASE_MS = 2000;
const PHASES: readonly BenchmarkPhase[] = ['pan', 'zoom', 'overview'];

function centeredCamera(view: Size, content: Size, zoom: number): Camera {
  return {
    zoom,
    offsetX: view.width / 2 - (content.width / 2) * zoom,
    offsetY: view.height / 2 - (content.height / 2) * zoom,
  };
}

/** Положение камеры в момент phaseTime (0…1) фазы. */
function cameraAt(phase: BenchmarkPhase, phaseTime: number, view: Size, content: Size): Camera {
  const angle = phaseTime * Math.PI * 2;
  const center = { x: view.width / 2, y: view.height / 2 };
  if (phase === 'pan') {
    const base = centeredCamera(view, content, 1);
    return {
      ...base,
      offsetX: base.offsetX + Math.cos(angle) * 600,
      offsetY: base.offsetY + Math.sin(angle) * 400,
    };
  }
  if (phase === 'zoom') {
    const factor = 0.3 + 1.7 * (0.5 - 0.5 * Math.cos(angle));
    return zoomAt(centeredCamera(view, content, 1), center, factor);
  }
  const fit = Math.min(view.width / content.width, view.height / content.height) * 0.9;
  const base = centeredCamera(view, content, fit);
  return {
    ...base,
    offsetX: base.offsetX + Math.cos(angle) * 80,
    offsetY: base.offsetY + Math.sin(angle) * 60,
  };
}

export function runAutoBenchmark(
  controller: PanZoomController,
  view: Size,
  content: Size,
): Promise<BenchmarkResult> {
  const frames: Record<BenchmarkPhase, number[]> = { pan: [], zoom: [], overview: [] };
  return new Promise((resolve) => {
    let start = 0;
    let previous = 0;
    const tick = (now: number): void => {
      if (start === 0) start = now;
      const elapsed = now - start;
      const phase = PHASES.at(Math.floor(elapsed / PHASE_MS));
      if (phase === undefined) {
        resolve({
          total: summarizeFrames([...frames.pan, ...frames.zoom, ...frames.overview]),
          phases: {
            pan: summarizeFrames(frames.pan),
            zoom: summarizeFrames(frames.zoom),
            overview: summarizeFrames(frames.overview),
          },
        });
        return;
      }
      if (previous !== 0) frames[phase].push(now - previous);
      previous = now;
      controller.setCamera(cameraAt(phase, (elapsed % PHASE_MS) / PHASE_MS, view, content));
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
}
