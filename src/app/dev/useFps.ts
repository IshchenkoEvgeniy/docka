import { useEffect, useState } from 'react';

const SAMPLE_MS = 500;

/** Живой счётчик FPS по requestAnimationFrame, обновляется дважды в секунду. */
export function useFps(): number {
  const [fps, setFps] = useState(0);

  useEffect(() => {
    let frame = 0;
    let frames = 0;
    let windowStart = performance.now();
    const tick = (now: number): void => {
      frames += 1;
      if (now - windowStart >= SAMPLE_MS) {
        setFps(Math.round((frames * 1000) / (now - windowStart)));
        frames = 0;
        windowStart = now;
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
    };
  }, []);

  return fps;
}
