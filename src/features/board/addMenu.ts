import type { Point } from '../../canvas';
import type { TranslationKey } from '../../i18n';
import type { MenuEntry } from '../../ui';
import { createBoardCard, createElementAt, openLibrary } from './boardActions';
import { action } from './menuAction';
import type { BoardModel } from './model';

/** Системные окна выбора файлов и окно адреса ссылки (их держит доска). */
export interface AddPickers {
  /** at — куда положить выбранное (точка мира); без неё — центр экрана. */
  readonly images: (at?: Point) => void;
  readonly files: (at?: Point) => void;
  readonly link: (at?: Point) => void;
}

/** Типы, которые создаются пустыми в точке: подпись пункта и горячая клавиша. */
const SIMPLE: readonly (readonly [string, TranslationKey, string | undefined])[] = [
  ['note', 'board.toolbar.addNote', 'addNote'],
  ['title', 'board.toolbar.addTitle', 'addTitle'],
  ['column', 'board.toolbar.addColumn', 'addColumn'],
  ['frame', 'frames.add', undefined],
  ['checklist', 'board.toolbar.addChecklist', 'addChecklist'],
  ['table', 'board.toolbar.addTable', undefined],
  ['shape', 'board.toolbar.addShape', 'addShape'],
  ['swatch', 'board.toolbar.addSwatch', undefined],
];

/** «Добавить»: все виды элементов (на телефоне — единственный способ их создать). */
export function addMenuEntries(model: BoardModel, at: Point, pickers: AddPickers): MenuEntry[] {
  const simple = SIMPLE.map(([type, label, hotkey]) =>
    action(
      `add-${type}`,
      label,
      () => {
        createElementAt(model, type, at);
      },
      hotkey === undefined ? {} : { hotkey },
    ),
  );
  return [
    ...simple,
    action(
      'add-image',
      'board.toolbar.addImage',
      () => {
        pickers.images(at);
      },
      { hotkey: 'addImage' },
    ),
    action('add-file', 'board.toolbar.addFile', () => {
      pickers.files(at);
    }),
    action(
      'add-link',
      'board.toolbar.addLink',
      () => {
        pickers.link(at);
      },
      { hotkey: 'addLink' },
    ),
    action(
      'add-board',
      'board.toolbar.addBoard',
      () => {
        createBoardCard(model, at);
      },
      { hotkey: 'addBoard' },
    ),
    action(
      'add-entity',
      'board.toolbar.addEntity',
      () => {
        openLibrary(model);
      },
      { hotkey: 'openLibrary', disabled: model.host.entities === null },
    ),
  ];
}
