/**
 * Камера холста. Связь координат: экран = мир × zoom + offset.
 * Мировые координаты — то, в чём хранятся позиции элементов; экранные — CSS-пиксели вьюпорта.
 */

import type { Point, Rect, Size } from './geometry';

export type { Point } from './geometry';

export interface Camera {
  readonly offsetX: number;
  readonly offsetY: number;
  readonly zoom: number;
}

export const MIN_ZOOM = 0.1;
export const MAX_ZOOM = 4;

export const INITIAL_CAMERA: Camera = { offsetX: 0, offsetY: 0, zoom: 1 };

export function clampZoom(zoom: number): number {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom));
}

export function worldToScreen(camera: Camera, world: Point): Point {
  return {
    x: world.x * camera.zoom + camera.offsetX,
    y: world.y * camera.zoom + camera.offsetY,
  };
}

export function screenToWorld(camera: Camera, screen: Point): Point {
  return {
    x: (screen.x - camera.offsetX) / camera.zoom,
    y: (screen.y - camera.offsetY) / camera.zoom,
  };
}

/** Сдвиг камеры на (dx, dy) экранных пикселей: содержимое едет вместе с пальцем. */
export function panBy(camera: Camera, dx: number, dy: number): Camera {
  return { ...camera, offsetX: camera.offsetX + dx, offsetY: camera.offsetY + dy };
}

/**
 * Масштабирование в factor раз так, чтобы точка мира под anchor (экран) осталась на месте.
 * Именно так ведут себя зум колесом к курсору и щипок двумя пальцами.
 */
export function zoomAt(camera: Camera, anchor: Point, factor: number): Camera {
  const zoom = clampZoom(camera.zoom * factor);
  const ratio = zoom / camera.zoom;
  return {
    zoom,
    offsetX: anchor.x - (anchor.x - camera.offsetX) * ratio,
    offsetY: anchor.y - (anchor.y - camera.offsetY) * ratio,
  };
}

/** CSS transform слоя элементов для данной камеры. */
export function cameraTransform(camera: Camera): string {
  return `translate(${String(camera.offsetX)}px, ${String(camera.offsetY)}px) scale(${String(camera.zoom)})`;
}

/** Масштаб «показать всё»: прямоугольник целиком в окне с отступом, не крупнее maxZoom. */
export function fitBounds(bounds: Rect, view: Size, padding = 48, maxZoom = 1): Camera {
  const availableWidth = Math.max(1, view.width - 2 * padding);
  const availableHeight = Math.max(1, view.height - 2 * padding);
  const fit = Math.min(
    availableWidth / Math.max(1, bounds.width),
    availableHeight / Math.max(1, bounds.height),
  );
  const zoom = clampZoom(Math.min(fit, maxZoom));
  return {
    zoom,
    offsetX: view.width / 2 - (bounds.x + bounds.width / 2) * zoom,
    offsetY: view.height / 2 - (bounds.y + bounds.height / 2) * zoom,
  };
}

/** Точный масштаб (например, 100 %) с центром окна на месте. */
export function zoomToLevel(camera: Camera, view: Size, zoom: number): Camera {
  return zoomAt(camera, { x: view.width / 2, y: view.height / 2 }, zoom / camera.zoom);
}
