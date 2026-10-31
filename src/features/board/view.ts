import {
  ELEMENT_ID_ATTRIBUTE,
  boundsOf,
  fitBounds,
  screenToWorld,
  visibleWorldRect,
  zoomToLevel,
  type CameraControls,
  type Point,
  type Rect,
  type Size,
} from '../../canvas';
import type { BoardModel } from './model';

/** Камера доски: размеры окна, «показать всё», масштаб кнопками. */

const ZOOM_STEP = 1.25;

export function viewSize(controls: CameraControls): Size | null {
  const container = controls.containerRef.current;
  if (container === null || container.clientWidth === 0) return null;
  return { width: container.clientWidth, height: container.clientHeight };
}

export function visibleRect(controls: CameraControls): Rect | null {
  const size = viewSize(controls);
  return size === null ? null : visibleWorldRect(controls.controller.getCamera(), size);
}

/** Точка мира под точкой вьюпорта; без точки — центр экрана. */
export function worldPoint(controls: CameraControls, screen: Point | null): Point {
  const size = viewSize(controls) ?? { width: 0, height: 0 };
  const point = screen ?? { x: size.width / 2, y: size.height / 2 };
  return screenToWorld(controls.controller.getCamera(), point);
}

/** Прямоугольник элемента в мире по его DOM-узлу (null — элемент не показан). */
export function measureElement(controls: CameraControls, elementId: string): Rect | null {
  const container = controls.containerRef.current;
  const node = container?.querySelector(`[${ELEMENT_ID_ATTRIBUTE}="${CSS.escape(elementId)}"]`);
  if (container === null || node === null || node === undefined) return null;
  const box = node.getBoundingClientRect();
  const origin = container.getBoundingClientRect();
  const camera = controls.controller.getCamera();
  const topLeft = screenToWorld(camera, { x: box.left - origin.left, y: box.top - origin.top });
  return { ...topLeft, width: box.width / camera.zoom, height: box.height / camera.zoom };
}

export function fitAll(model: BoardModel, controls: CameraControls): void {
  const size = viewSize(controls);
  const bounds = boundsOf(model.elements.getSnapshot().values());
  if (size === null || bounds === null) return;
  controls.controller.setCamera(fitBounds(bounds, size));
}

export function zoomTo(controls: CameraControls, zoom: number): void {
  const size = viewSize(controls);
  if (size !== null)
    controls.controller.setCamera(zoomToLevel(controls.controller.getCamera(), size, zoom));
}

export function zoomBy(controls: CameraControls, direction: 1 | -1): void {
  const { zoom } = controls.controller.getCamera();
  zoomTo(controls, direction === 1 ? zoom * ZOOM_STEP : zoom / ZOOM_STEP);
}
