/**
 * Движок холста: камера, координаты, hit-test, выделение, жесты, виртуализация.
 * Не знает конкретных типов элементов.
 */
export {
  INITIAL_CAMERA,
  MAX_ZOOM,
  MIN_ZOOM,
  cameraTransform,
  clampZoom,
  fitBounds,
  zoomToLevel,
  panBy,
  screenToWorld,
  worldToScreen,
  zoomAt,
} from './camera';
export type { Camera } from './camera';
export { boundsOf, containsPoint, rectFromCorners } from './geometry';
export type { Point } from './geometry';
export type { PanZoomController } from './panZoomController';
export { useCamera, useCameraControls } from './useCameraControls';
export type { CameraControls } from './useCameraControls';
export { Viewport } from './Viewport';
export {
  COMPACT_ZOOM_THRESHOLD,
  containsRect,
  detailForZoom,
  expandRect,
  intersects,
  nextDetailLevel,
  visibleWorldRect,
} from './visibility';
export type { DetailLevel, Rect, Size } from './visibility';
export { useDetailLevel, useRenderRect } from './useVisibility';
export { OverviewCanvas } from './OverviewCanvas';
export type { OverviewItem } from './overview';
export { ElementFrame, InteractionOverlay } from './ElementFrame';
export { resizeRect, resizeHandles } from './resize';
export type { ResizeMode, ResizeModifiers } from './resize';
export { EMPTY_SELECTION, createInteractionStore, useInteraction } from './interactionStore';
export type { Guide, InteractionState, InteractionStore } from './interactionStore';
export { pressSelection, releaseSelection, selectionInRect } from './selection';
export type { DeferredSelection } from './selection';
export type {
  GestureHandlers,
  PointerTarget,
  ReleaseKind,
  ResizeHandle,
} from './gestureController';
export { GRID_SIZE, SNAP_THRESHOLD_PX, snapMove, snapToGrid } from './snapping';
export { align, distribute } from './arrange';
export type { AlignMode, DistributeAxis, Move } from './arrange';
export { useProgressiveMount } from './useProgressiveMount';
export {
  CONNECTION_ID_ATTRIBUTE,
  CONTROL_ATTRIBUTE,
  ELEMENT_ID_ATTRIBUTE,
} from './attachPointerEvents';
export { arrowHead, connectorGeometry, facingSide } from './connectors';
export type { AnchorSide, ConnectorEnd, ConnectorGeometry, LineStyle, Side } from './connectors';
