import { useMemo } from 'react';
import { GRID_SIZE, type CameraControls, type Point } from '../../canvas';
import { useHotkeys, type HotkeyHandlers } from '../hotkeys';
import {
  clearSelection,
  createBoardCard,
  createNote,
  createElementAt,
  deleteSelection,
  editSelection,
  duplicateSelection,
  nudgeSelection,
  openLibrary,
  reorderSelection,
  selectAll,
  toggleLockSelection,
} from './boardActions';
import type { AddPickers } from './addMenu';
import { BOARD_HOTKEYS } from './boardHotkeys';
import type { BoardModel } from './model';
import { fitAll, worldPoint, zoomBy, zoomTo } from './view';

interface HotkeyContext {
  readonly model: BoardModel;
  readonly controls: CameraControls;
  /** Последняя точка указателя во вьюпорте: туда создаётся заметка по N. */
  readonly pointer: () => Point | null;
  readonly openHelp: () => void;
  readonly pickers: AddPickers;
}

function nudgeHandlers(model: BoardModel): HotkeyHandlers {
  const nudge = (dx: number, dy: number) => () => {
    nudgeSelection(model, dx, dy);
  };
  return {
    nudgeLeft: nudge(-1, 0),
    nudgeRight: nudge(1, 0),
    nudgeUp: nudge(0, -1),
    nudgeDown: nudge(0, 1),
    nudgeLeftFar: nudge(-GRID_SIZE, 0),
    nudgeRightFar: nudge(GRID_SIZE, 0),
    nudgeUpFar: nudge(0, -GRID_SIZE),
    nudgeDownFar: nudge(0, GRID_SIZE),
  };
}

function viewHandlers({ model, controls, openHelp }: HotkeyContext): HotkeyHandlers {
  return {
    fitAll: () => {
      fitAll(model, controls);
    },
    zoom100: () => {
      zoomTo(controls, 1);
    },
    zoomIn: () => {
      zoomBy(controls, 1);
    },
    zoomOut: () => {
      zoomBy(controls, -1);
    },
    toggleGrid: () => {
      model.settings.setState((state) => ({ gridSnap: !state.gridSnap }));
    },
    help: openHelp,
  };
}

function editHandlers({ model, controls, pointer, pickers }: HotkeyContext): HotkeyHandlers {
  const on = (action: (target: BoardModel) => void) => () => {
    action(model);
  };
  return {
    undo: () => void model.undo.undo(),
    redo: () => void model.undo.redo(),
    duplicate: on(duplicateSelection),
    delete: on(deleteSelection),
    addNote: () => {
      createNote(model, worldPoint(controls, pointer()));
    },
    addTitle: () => {
      createElementAt(model, 'title', worldPoint(controls, pointer()));
    },
    editText: on(editSelection),
    addImage: pickers.images,
    addLink: pickers.link,
    addShape: () => {
      createElementAt(model, 'shape', worldPoint(controls, pointer()));
    },
    addChecklist: () => {
      createElementAt(model, 'checklist', worldPoint(controls, pointer()));
    },
    addColumn: () => {
      createElementAt(model, 'column', worldPoint(controls, pointer()));
    },
    addBoard: () => {
      createBoardCard(model, worldPoint(controls, pointer()));
    },
    selectAll: on(selectAll),
    openLibrary: on(openLibrary),
    // Esc сначала отменяет начатый жест, потом снимает выделение.
    escape: () => {
      if (!controls.gestures.cancel()) clearSelection(model);
    },
    lock: on(toggleLockSelection),
    front: on((target) => {
      reorderSelection(target, 'front');
    }),
    back: on((target) => {
      reorderSelection(target, 'back');
    }),
  };
}

export function useBoardHotkeys(context: HotkeyContext, enabled: boolean): void {
  const { model, controls, pointer, openHelp, pickers } = context;
  const handlers = useMemo(() => {
    const full = { model, controls, pointer, openHelp, pickers };
    return { ...editHandlers(full), ...nudgeHandlers(model), ...viewHandlers(full) };
  }, [model, controls, pointer, openHelp, pickers]);
  useHotkeys(BOARD_HOTKEYS, handlers, enabled);
}
