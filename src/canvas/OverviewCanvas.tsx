import { useEffect, useRef } from 'react';
import { drawOverview, type OverviewItem } from './overview';
import type { CameraControls } from './useCameraControls';
import styles from './Viewport.module.css';

interface OverviewCanvasProps {
  readonly controls: CameraControls;
  readonly items: readonly OverviewItem[];
  /** Рисовать ли обзор (на крупном масштабе элементы рисуются DOM-ом, а холст пуст). */
  readonly active: boolean;
}

const RADIUS_WORLD = 8;

/** Значение CSS-переменной (например, '--color-card-yellow') для текущей темы. */
function createColorResolver(element: Element): (fill: string) => string {
  const computed = getComputedStyle(element);
  const cache = new Map<string, string>();
  return (fill) => {
    if (!fill.startsWith('--')) return fill;
    const cached = cache.get(fill);
    if (cached !== undefined) return cached;
    const value = computed.getPropertyValue(fill).trim();
    cache.set(fill, value);
    return value;
  };
}

/** Один <canvas> под слоем элементов: рисует все элементы на мелком масштабе. */
export function OverviewCanvas({ controls, items, active }: OverviewCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    if (canvas === null || context === null || context === undefined) return undefined;

    const draw = (): void => {
      const pixelRatio = window.devicePixelRatio;
      const view = { width: canvas.clientWidth, height: canvas.clientHeight };
      if (canvas.width !== view.width * pixelRatio) canvas.width = view.width * pixelRatio;
      if (canvas.height !== view.height * pixelRatio) canvas.height = view.height * pixelRatio;
      const resolve = createColorResolver(canvas);
      const visibleItems = active ? items : [];
      const style = { stroke: resolve('--color-border'), radius: RADIUS_WORLD };
      drawOverview(
        context,
        visibleItems,
        controls.controller.getCamera(),
        view,
        pixelRatio,
        style,
        resolve,
      );
    };

    draw();
    const unsubscribe = controls.subscribe(draw);
    const observer = new ResizeObserver(draw);
    observer.observe(canvas);
    return () => {
      unsubscribe();
      observer.disconnect();
    };
  }, [controls, items, active]);

  return <canvas ref={canvasRef} className={styles.overview} aria-hidden="true" />;
}
