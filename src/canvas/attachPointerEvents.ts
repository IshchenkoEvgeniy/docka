import type { Point } from './camera';
import type { GestureController, PointerTarget, ResizeHandle } from './gestureController';
import type { PointerKind } from './panZoomController';

/** Атрибут, которым помечается пустой фон холста (жест по нему = пан, а не работа с элементом). */
export const BACKGROUND_ATTRIBUTE = 'data-canvas-background';
/** Рамка элемента: по ней жесты понимают, какой элемент под пальцем. */
export const ELEMENT_ID_ATTRIBUTE = 'data-element-id';
export const RESIZE_HANDLE_ATTRIBUTE = 'data-resize-handle';
export const CONNECTION_ID_ATTRIBUTE = 'data-connection-id';
export const CONNECTOR_HANDLE_ATTRIBUTE = 'data-connector-handle';
/** Кнопка внутри элемента (свернуть колонку, галочка): нажатие — обычный клик, не жест холста. */
export const CONTROL_ATTRIBUTE = 'data-canvas-control';

function isControl(target: EventTarget | null): boolean {
  return target instanceof Element && target.closest(`[${CONTROL_ATTRIBUTE}]`) !== null;
}

const RESIZE_HANDLES: readonly string[] = ['e', 's', 'se'] satisfies ResizeHandle[];

function isResizeHandle(value: string | null): value is ResizeHandle {
  return value !== null && RESIZE_HANDLES.includes(value);
}

/** Что под указателем: ручка размера, элемент или пустое место. */
function targetOf(target: EventTarget | null): PointerTarget {
  if (!(target instanceof Element)) return { kind: 'background' };
  const connector = target
    .closest(`[${CONNECTOR_HANDLE_ATTRIBUTE}]`)
    ?.getAttribute(CONNECTOR_HANDLE_ATTRIBUTE);
  if (connector !== undefined && connector !== null) return { kind: 'connector', id: connector };
  const connection = target
    .closest(`[${CONNECTION_ID_ATTRIBUTE}]`)
    ?.getAttribute(CONNECTION_ID_ATTRIBUTE);
  if (connection !== undefined && connection !== null)
    return { kind: 'connection', id: connection };
  const frame = target.closest(`[${ELEMENT_ID_ATTRIBUTE}]`);
  const id = frame?.getAttribute(ELEMENT_ID_ATTRIBUTE) ?? null;
  if (id === null) return { kind: 'background' };
  const handle =
    target.closest(`[${RESIZE_HANDLE_ATTRIBUTE}]`)?.getAttribute(RESIZE_HANDLE_ATTRIBUTE) ?? null;
  return isResizeHandle(handle) ? { kind: 'handle', id, handle } : { kind: 'element', id };
}

function localPoint(container: HTMLElement, event: { clientX: number; clientY: number }): Point {
  const rect = container.getBoundingClientRect();
  return { x: event.clientX - rect.left, y: event.clientY - rect.top };
}

function toPointerKind(type: string): PointerKind {
  return type === 'touch' || type === 'pen' ? type : 'mouse';
}

function isEditable(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable ||
      target instanceof HTMLInputElement ||
      target instanceof HTMLTextAreaElement)
  );
}

function attachPointer(container: HTMLElement, controller: GestureController): () => void {
  const onDown = (event: PointerEvent): void => {
    // Внутри редактируемого текста указатель работает как обычно (выделение текста, курсор).
    if (isEditable(event.target) || isControl(event.target)) return;
    const captured = controller.pointerDown({
      id: event.pointerId,
      kind: toPointerKind(event.pointerType),
      button: event.button,
      point: localPoint(container, event),
      target: targetOf(event.target),
      additive: event.shiftKey || event.ctrlKey || event.metaKey,
    });
    if (!captured) return;
    event.preventDefault();
    container.setPointerCapture(event.pointerId);
  };
  const onMove = (event: PointerEvent): void => {
    controller.pointerMove(event.pointerId, localPoint(container, event));
  };
  const onUp = (event: PointerEvent): void => {
    controller.pointerUp(event.pointerId);
  };
  const onCancel = (event: PointerEvent): void => {
    controller.cancel();
    controller.pointerUp(event.pointerId);
  };
  container.addEventListener('pointerdown', onDown);
  container.addEventListener('pointermove', onMove);
  container.addEventListener('pointerup', onUp);
  container.addEventListener('pointercancel', onCancel);
  return () => {
    container.removeEventListener('pointerdown', onDown);
    container.removeEventListener('pointermove', onMove);
    container.removeEventListener('pointerup', onUp);
    container.removeEventListener('pointercancel', onCancel);
  };
}

function attachWheel(container: HTMLElement, controller: GestureController): () => void {
  const onWheel = (event: WheelEvent): void => {
    // Без preventDefault браузер сам масштабирует страницу по Ctrl + колесо.
    event.preventDefault();
    controller.wheel({
      point: localPoint(container, event),
      deltaX: event.deltaX,
      deltaY: event.deltaY,
      deltaMode: event.deltaMode,
      ctrlKey: event.ctrlKey || event.metaKey,
      shiftKey: event.shiftKey,
    });
  };
  container.addEventListener('wheel', onWheel, { passive: false });
  return () => {
    container.removeEventListener('wheel', onWheel);
  };
}

function attachSpaceKey(controller: GestureController): () => void {
  const onKey = (event: KeyboardEvent): void => {
    if (event.code !== 'Space' || isEditable(event.target)) return;
    event.preventDefault();
    controller.panZoom.setSpaceHeld(event.type === 'keydown');
  };
  const onBlur = (): void => {
    controller.panZoom.setSpaceHeld(false);
  };
  window.addEventListener('keydown', onKey);
  window.addEventListener('keyup', onKey);
  window.addEventListener('blur', onBlur);
  return () => {
    window.removeEventListener('keydown', onKey);
    window.removeEventListener('keyup', onKey);
    window.removeEventListener('blur', onBlur);
  };
}

/**
 * Правая кнопка мыши — меню. Долгое нажатие пальцем браузер тоже превращает в contextmenu,
 * но его уже обработал GestureController, поэтому для пальца событие только гасится.
 */
function attachContextMenu(
  container: HTMLElement,
  openMenu: (target: PointerTarget, point: Point) => void,
): () => void {
  let lastKind: PointerKind = 'mouse';
  const onDown = (event: PointerEvent): void => {
    lastKind = toPointerKind(event.pointerType);
  };
  const onMenu = (event: MouseEvent): void => {
    if (isEditable(event.target)) return;
    event.preventDefault();
    if (lastKind === 'mouse') openMenu(targetOf(event.target), localPoint(container, event));
  };
  container.addEventListener('pointerdown', onDown, { capture: true });
  container.addEventListener('contextmenu', onMenu);
  return () => {
    container.removeEventListener('pointerdown', onDown, { capture: true });
    container.removeEventListener('contextmenu', onMenu);
  };
}

/** Подключает мышь, тач, стилус, колесо, пробел и меню к контроллеру. Возвращает функцию отключения. */
export function attachPointerEvents(
  container: HTMLElement,
  controller: GestureController,
  openMenu: (target: PointerTarget, point: Point) => void,
): () => void {
  const detachers = [
    attachPointer(container, controller),
    attachWheel(container, controller),
    attachSpaceKey(controller),
    attachContextMenu(container, openMenu),
  ];
  return () => {
    detachers.forEach((detach) => {
      detach();
    });
  };
}
