import type * as Y from 'yjs';
import { createStore, type StoreApi } from 'zustand/vanilla';
import { createInteractionStore, type InteractionStore } from '../../canvas';
import type {
  BoardCommand,
  BoardId,
  CommandEnvironment,
  CommandResult,
  NewElement,
  RichNode,
} from '../../core';
import {
  combineUndoHistories,
  createBoardConnectionsStore,
  createBoardElementsStore,
  createUndoHistory,
  executeBoardCommand,
  fragmentToRich,
  textOf,
  type BoardConnectionsStore,
  type BoardElementsStore,
  type CombinedUndoHistory,
} from '../../data';
import { TEXT_EDIT_ORIGIN } from '../../elements';
import { NO_HOST, type BoardHost } from './host';

/** Настройки работы с доской (эфемерные; в настройки приложения переедут на этапе 3). */
export interface BoardSettings {
  readonly gridSnap: boolean;
}

export interface BoardNotice {
  readonly message: string | null;
}

/** Окно поверх доски: цвет, подпись стрелки, фон доски. */
export type BoardDialog =
  | { readonly kind: 'elementColor' }
  | { readonly kind: 'connectionColor'; readonly connectionId: string }
  | { readonly kind: 'label'; readonly connectionId: string }
  | { readonly kind: 'background' }
  /** Вставка элементов-ссылок на сущности: ссылка на те же или независимые копии. */
  | { readonly kind: 'references'; readonly elements: readonly NewElement[] };

/** Поверх доски: картинка на весь экран или окно настройки. */
export interface BoardOverlay {
  readonly viewingId: string | null;
  readonly dialog: BoardDialog | null;
}

/** Всё, что нужно сценариям доски: данные, отмена, выделение, настройки, сообщения. */
export interface BoardModel {
  readonly doc: Y.Doc;
  readonly boardId: BoardId;
  readonly host: BoardHost;
  readonly overlay: StoreApi<BoardOverlay>;
  readonly elements: BoardElementsStore;
  readonly connections: BoardConnectionsStore;
  /** batch — несколько команд разных документов одним шагом отмены. */
  readonly undo: CombinedUndoHistory;
  readonly interaction: InteractionStore;
  readonly settings: StoreApi<BoardSettings>;
  readonly notice: StoreApi<BoardNotice>;
  /** Выполняет команду; при ошибке показывает сообщение и возвращает null. */
  readonly run: (command: BoardCommand) => CommandResult | null;
  readonly showNotice: (message: string) => void;
  /** Текст элемента в нейтральном виде или null (нет текста в Yjs). */
  readonly richTextOf: (elementId: string) => RichNode[] | null;
  /**
   * Элементы, которые только что создали или растянули на этом устройстве: их измеренную
   * высоту можно записать. Чужие правки не перемеряются — иначе устройства с разными
   * шрифтами бесконечно переписывали бы высоту друг за другом.
   */
  readonly markForMeasure: (elementIds: Iterable<string>) => void;
  readonly shouldMeasure: (elementId: string) => boolean;
  readonly destroy: () => void;
}

const MEASURE_WINDOW_MS = 3000;

const NOTICE_MS = 4000;

/** Сообщение внизу экрана, которое само скрывается. */
function createNotices() {
  const notice = createStore<BoardNotice>(() => ({ message: null }));
  let timer: ReturnType<typeof setTimeout> | undefined;
  const showNotice = (message: string): void => {
    clearTimeout(timer);
    notice.setState({ message });
    timer = setTimeout(() => {
      notice.setState({ message: null });
    }, NOTICE_MS);
  };
  return {
    notice,
    showNotice,
    stopNotices: () => {
      clearTimeout(timer);
    },
  };
}

/** Какие элементы можно перемерить: правятся сейчас или только что созданы/растянуты здесь. */
function createMeasureTracker(
  interaction: InteractionStore,
): Pick<BoardModel, 'markForMeasure' | 'shouldMeasure'> {
  const measureUntil = new Map<string, number>();
  return {
    markForMeasure: (elementIds) => {
      const until = Date.now() + MEASURE_WINDOW_MS;
      for (const id of elementIds) measureUntil.set(id, until);
    },
    shouldMeasure: (elementId) =>
      interaction.getState().editingId === elementId ||
      (measureUntil.get(elementId) ?? 0) > Date.now(),
  };
}

/** Выделение не должно ссылаться на удалённое (отмена, корзина, правка с другого устройства). */
function pruneSelection(elements: BoardElementsStore, interaction: InteractionStore): void {
  const { selection } = interaction.getState();
  const snapshot = elements.getSnapshot();
  const kept = [...selection].filter((id) => snapshot.has(id));
  if (kept.length !== selection.size) interaction.setState({ selection: new Set(kept) });
}

/** История доски; правки сущностей с этой доски отменяются той же историей (ADR 0004). */
function boardHistory(doc: Y.Doc, host: BoardHost) {
  const boardUndo = createUndoHistory(doc, ['elements', 'connections'], {
    mergeOrigins: [TEXT_EDIT_ORIGIN],
  });
  const projectUndo = host.entities?.history;
  const undo = combineUndoHistories(
    projectUndo === undefined ? [boardUndo] : [boardUndo, projectUndo],
  );
  return {
    undo,
    destroyHistory: () => {
      undo.destroy();
      boardUndo.destroy();
    },
  };
}

export function createBoardModel(
  doc: Y.Doc,
  boardId: BoardId,
  environment: CommandEnvironment,
  host: BoardHost = NO_HOST,
): BoardModel {
  const elements = createBoardElementsStore(doc);
  const connections = createBoardConnectionsStore(doc);
  const { undo, destroyHistory } = boardHistory(doc, host);
  const interaction = createInteractionStore();
  const measure = createMeasureTracker(interaction);
  const settings = createStore<BoardSettings>(() => ({ gridSnap: false }));
  const { notice, showNotice, stopNotices } = createNotices();
  const unsubscribe = elements.subscribe(() => {
    pruneSelection(elements, interaction);
  });
  return {
    doc,
    boardId,
    host,
    overlay: createStore<BoardOverlay>(() => ({ viewingId: null, dialog: null })),
    elements,
    connections,
    undo,
    interaction,
    settings,
    notice,
    showNotice,
    run: (command) => {
      const result = executeBoardCommand(doc, boardId, command, environment);
      if (result.ok) return result.value;
      showNotice(result.error);
      return null;
    },
    richTextOf: (elementId) => {
      const fragment = textOf(doc, elementId);
      return fragment === null ? null : fragmentToRich(fragment);
    },
    ...measure,
    destroy: () => {
      stopNotices();
      unsubscribe();
      destroyHistory();
      elements.destroy();
      connections.destroy();
    },
  };
}
