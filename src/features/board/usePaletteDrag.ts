import { useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import type { CameraControls, Point } from '../../canvas';
import type { AddPickers } from './addMenu';
import type { BoardModel } from './model';
import { canvasPoint, columnAt, columnSlot } from './paletteDrop';
import type { PaletteTool } from './paletteTools';
import { worldPoint } from './view';

/** Сдвиг пальца или мыши, после которого нажатие становится перетаскиванием. */
const DRAG_START_PX = 6;

export interface PaletteGhost {
  readonly tool: PaletteTool;
  readonly client: Point;
  /** Над холстом: отпустить — положить элемент. */
  readonly overCanvas: boolean;
}

interface Press {
  readonly tool: PaletteTool;
  readonly start: Point;
  dragging: boolean;
}

function showColumnTarget(model: BoardModel, columnId: string | null): void {
  // Подсветка колонки — та же, что при перетаскивании карточки (ElementFrame.dropTarget).
  const target =
    columnId === null
      ? null
      : { ids: new Set<string>(), dx: 0, dy: 0, raise: new Set<string>(), target: columnId };
  model.interaction.setState({ drag: target });
}

interface DragParts {
  readonly press: { current: Press | null };
  readonly suppressClick: { current: boolean };
  readonly hover: (tool: PaletteTool, client: Point) => void;
  readonly drop: (tool: PaletteTool, client: Point) => void;
  readonly finish: () => void;
}

/** Обработчики значка: нажатие → перетаскивание после порога → бросок или щелчок. */
function pointerHandlers(tool: PaletteTool, parts: DragParts, click: () => void) {
  const { press, suppressClick, hover, drop, finish } = parts;
  return {
    onPointerDown: (event: ReactPointerEvent<HTMLButtonElement>) => {
      if (event.button !== 0) return;
      press.current = { tool, start: { x: event.clientX, y: event.clientY }, dragging: false };
      event.currentTarget.setPointerCapture(event.pointerId);
    },
    onPointerMove: (event: ReactPointerEvent<HTMLButtonElement>) => {
      const current = press.current;
      if (current === null) return;
      const client = { x: event.clientX, y: event.clientY };
      const moved = Math.hypot(client.x - current.start.x, client.y - current.start.y);
      if (!current.dragging && moved < DRAG_START_PX) return;
      current.dragging = true;
      hover(current.tool, client);
    },
    onPointerUp: (event: ReactPointerEvent<HTMLButtonElement>) => {
      if (press.current?.dragging === true) {
        suppressClick.current = true;
        drop(press.current.tool, { x: event.clientX, y: event.clientY });
      }
      finish();
    },
    onPointerCancel: finish,
    onClick: () => {
      if (suppressClick.current) {
        suppressClick.current = false;
        return;
      }
      click();
    },
  };
}

/**
 * Перетаскивание значка с панели на доску (или в колонку), как в Milanote. Простое нажатие
 * кладёт элемент в центр экрана.
 */
export function usePaletteDrag(model: BoardModel, controls: CameraControls, pickers: AddPickers) {
  const press = useRef<Press | null>(null);
  const suppressClick = useRef(false);
  const [ghost, setGhost] = useState<PaletteGhost | null>(null);

  const hover = (tool: PaletteTool, client: Point): void => {
    const overCanvas = canvasPoint(controls, client) !== null;
    setGhost({ tool, client, overCanvas });
    showColumnTarget(model, overCanvas ? (columnAt(model, client)?.id ?? null) : null);
  };
  const drop = (tool: PaletteTool, client: Point): void => {
    const at = canvasPoint(controls, client);
    if (at === null) return;
    const column = columnAt(model, client);
    tool.place(
      model,
      at,
      pickers,
      column === null ? null : columnSlot(model, controls, column, at),
    );
  };
  const finish = (): void => {
    press.current = null;
    setGhost(null);
    showColumnTarget(model, null);
  };

  const handlers = (tool: PaletteTool) =>
    pointerHandlers(tool, { press, suppressClick, hover, drop, finish }, () => {
      tool.place(model, worldPoint(controls, null), pickers, null);
    });

  return { ghost, handlers };
}
