import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type RefObject,
} from 'react';
import { INITIAL_CAMERA, cameraTransform, type Camera } from './camera';
import { attachPointerEvents } from './attachPointerEvents';
import { GestureController, type GestureHandlers } from './gestureController';
import type { PanZoomController } from './panZoomController';

export interface CameraControls {
  readonly containerRef: RefObject<HTMLDivElement | null>;
  readonly layerRef: RefObject<HTMLDivElement | null>;
  /** Камера: пан, зум, «показать всё». */
  readonly controller: PanZoomController;
  /** Жесты с элементами (выделение, перетаскивание, рамка); Esc — gestures.cancel(). */
  readonly gestures: GestureController;
  /** Подписка на изменения камеры (не чаще одного раза за кадр). */
  readonly subscribe: (listener: () => void) => () => void;
}

const GRID_WORLD = 24;
const GRID_MIN_PX = 12;

/** Фон доски (точки, сетка) движется и масштабируется вместе с доской, но не мельчит. */
function setGridVariables(container: HTMLElement, camera: Camera): void {
  let step = GRID_WORLD * camera.zoom;
  while (step < GRID_MIN_PX) step *= 2;
  container.style.setProperty('--grid-step', `${String(step)}px`);
  container.style.setProperty('--grid-x', `${String(camera.offsetX)}px`);
  container.style.setProperty('--grid-y', `${String(camera.offsetY)}px`);
}

/**
 * Камера и жесты холста. Transform слоя меняется напрямую в requestAnimationFrame, минуя React:
 * пан и зум не вызывают перерисовку элементов. Без handlers холст только панится и масштабируется.
 */
export function useCameraControls(
  initial: Camera = INITIAL_CAMERA,
  handlers: GestureHandlers | null = null,
): CameraControls {
  const containerRef = useRef<HTMLDivElement>(null);
  const layerRef = useRef<HTMLDivElement>(null);
  const handlersRef = useRef(handlers);
  useLayoutEffect(() => {
    handlersRef.current = handlers;
  });

  const [controls] = useState(() => {
    const listeners = new Set<() => void>();
    let frame = 0;
    const render = (): void => {
      frame = 0;
      const layer = layerRef.current;
      const camera = gestures.panZoom.getCamera();
      if (layer !== null) {
        layer.style.transform = cameraTransform(camera);
        // Рамки, ручки и направляющие делят свои размеры на зум, чтобы на экране оставаться одинаковыми.
        layer.style.setProperty('--canvas-zoom', String(camera.zoom));
      }
      const container = containerRef.current;
      if (container !== null) setGridVariables(container, camera);
      listeners.forEach((listener) => {
        listener();
      });
    };
    const gestures = new GestureController(
      initial,
      () => {
        if (frame === 0) frame = requestAnimationFrame(render);
      },
      () => handlersRef.current,
    );
    const subscribe = (listener: () => void): (() => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    };
    return { containerRef, layerRef, controller: gestures.panZoom, gestures, subscribe };
  });

  useEffect(() => {
    const container = containerRef.current;
    if (container === null) return undefined;
    controls.controller.setCamera(controls.controller.getCamera());
    return attachPointerEvents(container, controls.gestures, (target, point) => {
      handlersRef.current?.openMenu(target, point);
    });
  }, [controls]);

  return controls;
}

/** Текущая камера для интерфейса (например, процент масштаба). Обновляется не чаще кадра. */
export function useCamera(controls: CameraControls): Camera {
  return useSyncExternalStore(controls.subscribe, controls.controller.getCamera);
}
