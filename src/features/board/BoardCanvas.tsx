import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type * as Y from 'yjs';
import {
  INITIAL_CAMERA,
  InteractionOverlay,
  Viewport,
  useCameraControls,
  type Camera,
  type CameraControls,
  type Point,
} from '../../canvas';
import type { BoardBackground, BoardId, CommandEnvironment } from '../../core';
import { t } from '../../i18n';
import { ElementRuntimeContext, useTags } from '../../elements';
import { Dialog, Menu } from '../../ui';
import { HotkeyList } from '../hotkeys';
import { pastePayload } from './boardActions';
import { BOARD_HOTKEYS } from './boardHotkeys';
import { BoardNotice, BoardToolbar } from './BoardToolbar';
import { BoardDialogs } from './BoardDialogs';
import { ConnectionLayer } from './ConnectionLayer';
import { BoardOverview, ElementLayer } from './ElementLayer';
import { createGestureHandlers } from './gestureHandlers';
import type { BoardHost } from './host';
import { FullscreenEditing } from './FullscreenEditing';
import { ElementViewer } from './ElementViewer';
import { HighlightSync } from './HighlightSync';
import { FindBar } from './FindBar';
import { useFocusFeed } from './useFocusFeed';
import { useBoardPickers } from './pickers';
import { insertShared } from './shared';
import { createElementRuntime } from './runtime';
import { menuContent, type MenuState } from './boardMenus';
import { createBoardModel, type BoardModel } from './model';
import { useBoardHotkeys } from './useBoardHotkeys';
import { useClipboardEvents } from './useClipboardEvents';
import { fitAll, measureElement, visibleRect, worldPoint } from './view';
import styles from './Board.module.css';

/** Полученное через «Поделиться» ложится на открытую доску в центр экрана. */
function useSharedInbox(model: BoardModel, controls: CameraControls): void {
  useEffect(() => {
    const inbox = model.host.inbox;
    if (inbox === null) return undefined;
    const consume = (): void => {
      const items = inbox.take();
      if (items.length > 0) void insertShared(model, items, worldPoint(controls, null));
    };
    const frame = requestAnimationFrame(consume);
    const unsubscribe = inbox.subscribe(consume);
    return () => {
      cancelAnimationFrame(frame);
      unsubscribe();
    };
  }, [model, controls]);
}

/** «На доску» из библиотеки (телефон): элементы ложатся в центр экрана как есть. */
function usePlacements(model: BoardModel, controls: CameraControls): void {
  useEffect(() => {
    const feed = model.host.placements;
    if (feed === null) return undefined;
    const consume = (): void => {
      for (const payload of feed.take())
        pastePayload(model, payload, worldPoint(controls, null), false);
    };
    const frame = requestAnimationFrame(consume);
    const unsubscribe = feed.subscribe(consume);
    return () => {
      cancelAnimationFrame(frame);
      unsubscribe();
    };
  }, [model, controls]);
}

/** Камера доски, запомненная на устройстве: с какой открыть и куда сообщать изменения (объект должен быть стабильным). */
export interface BoardCameraMemory {
  /** null — доска открывается впервые: показать всё. */
  readonly initial: Camera | null;
  readonly onChange: (camera: Camera) => void;
}

const CAMERA_SAVE_DELAY_MS = 500;

/** Открытая доска: запомненная камера или «показать всё»; изменения камеры — с задержкой. */
function useCameraMemory(model: BoardModel, controls: CameraControls, memory?: BoardCameraMemory) {
  useEffect(() => {
    const remembered = memory?.initial ?? null;
    const frame = requestAnimationFrame(() => {
      if (remembered === null) fitAll(model, controls);
      else controls.controller.setCamera(remembered);
    });
    let timer: ReturnType<typeof setTimeout> | undefined;
    const unsubscribe = controls.subscribe(() => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        memory?.onChange(controls.controller.getCamera());
      }, CAMERA_SAVE_DELAY_MS);
    });
    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(timer);
      unsubscribe();
      memory?.onChange(controls.controller.getCamera());
    };
  }, [model, controls, memory]);
}

function BoardSurface({
  model,
  camera,
  background,
}: {
  readonly model: BoardModel;
  readonly camera: BoardCameraMemory | undefined;
  readonly background: BoardBackground;
}) {
  const [menu, setMenu] = useState<MenuState | null>(null);
  const [help, setHelp] = useState(false);
  const controlsRef = useRef<CameraControls | null>(null);
  const pointerRef = useRef<Point | null>(null);
  const handlers = useMemo(
    () =>
      createGestureHandlers(model, {
        getCamera: () => controlsRef.current?.controller.getCamera() ?? INITIAL_CAMERA,
        measure: (elementId) =>
          controlsRef.current === null ? null : measureElement(controlsRef.current, elementId),
        getVisibleRect: () =>
          controlsRef.current === null ? null : visibleRect(controlsRef.current),
        openMenu: (target, screen) => {
          setMenu({ kind: 'context', target, screen });
        },
      }),
    [model],
  );
  const controls = useCameraControls(INITIAL_CAMERA, handlers);
  const runtime = useMemo(() => createElementRuntime(model), [model]);
  useLayoutEffect(() => {
    controlsRef.current = controls;
  }, [controls]);

  const pointer = useCallback(() => pointerRef.current, []);
  const openHelp = useCallback(() => {
    setHelp(true);
  }, []);
  const closeHelp = useCallback(() => {
    setHelp(false);
  }, []);
  const closeMenu = useCallback(() => {
    setMenu(null);
  }, []);
  const { pickers, inputs } = useBoardPickers(model, controls);
  const tags = useTags();
  useBoardHotkeys({ model, controls, pointer, openHelp, pickers }, menu === null && !help);
  useClipboardEvents(model, controls, pointer);

  useCameraMemory(model, controls, camera);
  useSharedInbox(model, controls);
  usePlacements(model, controls);
  useFocusFeed(model, controls);

  return (
    <div
      className={styles.board}
      onPointerMove={(event) => {
        const rect = controls.containerRef.current?.getBoundingClientRect();
        if (rect !== undefined)
          pointerRef.current = { x: event.clientX - rect.left, y: event.clientY - rect.top };
      }}
    >
      <ElementRuntimeContext.Provider value={runtime}>
        <Viewport
          controls={controls}
          background={background}
          underlay={<BoardOverview model={model} controls={controls} />}
        >
          <ConnectionLayer model={model} />
          <ElementLayer model={model} controls={controls} />
          <InteractionOverlay store={model.interaction} />
        </Viewport>
        <HighlightSync model={model} />
        <ElementViewer model={model} />
        <FullscreenEditing model={model} runtime={runtime} />
        <BoardDialogs model={model} background={background} />
      </ElementRuntimeContext.Provider>
      <BoardToolbar
        model={model}
        controls={controls}
        onHelp={openHelp}
        onOpenMenu={(kind, anchor) => {
          setMenu({ kind, client: { x: anchor.left, y: anchor.bottom + 4 } });
        }}
      />
      <BoardNotice model={model} />
      <FindBar model={model} controls={controls} />
      {inputs}
      {menu !== null && (
        <Menu {...menuContent(menu, model, controls, pickers, tags)} onClose={closeMenu} />
      )}
      {help && (
        <Dialog title={t('hotkeys.title')} closeLabel={t('common.close')} onClose={closeHelp}>
          <HotkeyList definitions={BOARD_HOTKEYS} />
        </Dialog>
      )}
    </div>
  );
}

interface BoardCanvasProps {
  readonly doc: Y.Doc;
  readonly boardId: BoardId;
  readonly environment: CommandEnvironment;
  readonly camera?: BoardCameraMemory;
  /** Проект доски: файлы и переходы. Стабильный объект. */
  readonly host?: BoardHost;
  readonly background?: BoardBackground;
}

/** Доска: холст с элементами, жесты, меню, горячие клавиши, буфер обмена. */
export function BoardCanvas({
  doc,
  boardId,
  environment,
  camera,
  host,
  background = 'dots',
}: BoardCanvasProps) {
  const [model, setModel] = useState<BoardModel | null>(null);
  useEffect(() => {
    const created = createBoardModel(doc, boardId, environment, host);
    setModel(created);
    return () => {
      created.destroy();
    };
  }, [doc, boardId, environment, host]);
  return model === null ? null : (
    <BoardSurface key={model.boardId} model={model} camera={camera} background={background} />
  );
}
