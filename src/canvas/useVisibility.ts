import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import type { CameraControls } from './useCameraControls';
import {
  detailForZoom,
  nextDetailLevel,
  nextRenderRect,
  visibleWorldRect,
  type DetailLevel,
  type Rect,
} from './visibility';

/**
 * Запас вокруг экрана: по четверти экрана с каждой стороны. Больший запас реже пересчитывается,
 * но при пересчёте монтирует больше элементов за один кадр — это и есть рывки при зуме.
 */
const RENDER_MARGIN = 0.25;

/** Размер вьюпорта в CSS-пикселях, следит за изменением окна. */
function useViewportSize(controls: CameraControls): { width: number; height: number } | null {
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);
  useEffect(() => {
    const container = controls.containerRef.current;
    if (container === null) return undefined;
    const observer = new ResizeObserver(() => {
      setSize({ width: container.clientWidth, height: container.clientHeight });
    });
    observer.observe(container);
    return () => {
      observer.disconnect();
    };
  }, [controls]);
  return size;
}

/**
 * Область мира, элементы в которой нужно рендерить (null — размер вьюпорта ещё неизвестен).
 * Меняется редко: только когда экран выходит за пределы запаса.
 */
export function useRenderRect(controls: CameraControls): Rect | null {
  const size = useViewportSize(controls);
  const rectRef = useRef<Rect | null>(null);
  const getSnapshot = useCallback((): Rect | null => {
    if (size === null) return null;
    const visible = visibleWorldRect(controls.controller.getCamera(), size);
    rectRef.current = nextRenderRect(rectRef.current, visible, RENDER_MARGIN);
    return rectRef.current;
  }, [controls, size]);
  return useSyncExternalStore(controls.subscribe, getSnapshot);
}

/**
 * Уровень детализации элементов; компонент перерисовывается только при смене уровня.
 * simplify = false — содержимое на любом масштабе (настройка устройства).
 */
export function useDetailLevel(controls: CameraControls, simplify = true): DetailLevel {
  const levelRef = useRef<DetailLevel | null>(null);
  const getSnapshot = useCallback((): DetailLevel => {
    if (!simplify) return 'full';
    const zoom = controls.controller.getCamera().zoom;
    levelRef.current =
      levelRef.current === null ? detailForZoom(zoom) : nextDetailLevel(levelRef.current, zoom);
    return levelRef.current;
  }, [controls, simplify]);
  return useSyncExternalStore(controls.subscribe, getSnapshot);
}
