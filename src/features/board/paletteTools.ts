import { EMPTY_SELECTION, type Point } from '../../canvas';
import type { ConnectionId } from '../../core';
import type { TranslationKey } from '../../i18n';
import type { IconName } from '../../ui';
import type { AddPickers } from './addMenu';
import { createBoardCard, createElementAt, createNote } from './boardActions';
import type { BoardModel } from './model';

/** Что кладёт значок панели: в точку, куда его бросили, или в центр экрана по нажатию. */
export interface PaletteTool {
  readonly id: string;
  readonly icon: IconName;
  readonly label: TranslationKey;
  readonly place: (model: BoardModel, at: Point, pickers: AddPickers) => void;
}

const LINE_LENGTH = 200;

/** Отдельная стрелка без карточек: концы потом тянут к элементам. */
function createLine(model: BoardModel, at: Point): void {
  const half = LINE_LENGTH / 2;
  const result = model.run({
    kind: 'createConnection',
    from: { kind: 'point', x: Math.round(at.x - half), y: Math.round(at.y) },
    to: { kind: 'point', x: Math.round(at.x + half), y: Math.round(at.y) },
    style: { lineStyle: 'straight', endMarker: 'arrow' },
  });
  if (result?.createdId !== undefined)
    model.interaction.setState({
      selection: EMPTY_SELECTION,
      connectionSelection: new Set([result.createdId as ConnectionId]), // id новой стрелки
    });
}

/** Карточки — в порядке панели Milanote; «Ещё» (остальные виды) панель добавляет сама. */
export const CARD_TOOLS: readonly PaletteTool[] = [
  {
    id: 'note',
    icon: 'note',
    label: 'board.palette.note',
    place: (model, at) => {
      createNote(model, at);
    },
  },
  {
    id: 'link',
    icon: 'link',
    label: 'board.palette.link',
    place: (_model, at, pickers) => {
      pickers.link(at);
    },
  },
  {
    id: 'checklist',
    icon: 'todo',
    label: 'board.palette.checklist',
    place: (model, at) => {
      createElementAt(model, 'checklist', at);
    },
  },
  { id: 'line', icon: 'line', label: 'board.palette.line', place: createLine },
  {
    id: 'board',
    icon: 'board',
    label: 'board.palette.board',
    place: (model, at) => {
      createBoardCard(model, at);
    },
  },
  {
    id: 'column',
    icon: 'column',
    label: 'board.palette.column',
    place: (model, at) => {
      createElementAt(model, 'column', at);
    },
  },
];

/** Файлы с устройства: сначала системное окно выбора, потом — в точку. */
export const FILE_TOOLS: readonly PaletteTool[] = [
  {
    id: 'image',
    icon: 'image',
    label: 'board.palette.image',
    place: (_model, at, pickers) => {
      pickers.images(at);
    },
  },
  {
    id: 'file',
    icon: 'upload',
    label: 'board.palette.file',
    place: (_model, at, pickers) => {
      pickers.files(at);
    },
  },
];
