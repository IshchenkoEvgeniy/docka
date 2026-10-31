export interface FrameStats {
  /** Средний FPS за замер. */
  readonly averageFps: number;
  /** «1 % low»: FPS по 99-му перцентилю длительности кадра — видно редкие подтормаживания. */
  readonly lowFps: number;
  /** Самый долгий кадр, мс. */
  readonly worstFrameMs: number;
  readonly frames: number;
}

/** Сводка по длительностям кадров в миллисекундах. */
export function summarizeFrames(frameTimesMs: readonly number[]): FrameStats {
  if (frameTimesMs.length === 0) {
    return { averageFps: 0, lowFps: 0, worstFrameMs: 0, frames: 0 };
  }
  const total = frameTimesMs.reduce((sum, time) => sum + time, 0);
  const sorted = [...frameTimesMs].sort((a, b) => a - b);
  const p99 = sorted.at(Math.min(sorted.length - 1, Math.floor(sorted.length * 0.99))) ?? 0;
  const worst = sorted.at(-1) ?? 0;
  return {
    averageFps: Math.round((1000 * frameTimesMs.length) / total),
    lowFps: p99 > 0 ? Math.round(1000 / p99) : 0,
    worstFrameMs: Math.round(worst * 10) / 10,
    frames: frameTimesMs.length,
  };
}
