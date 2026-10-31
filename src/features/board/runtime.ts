import type { ElementId } from '../../core';
import { ensureText, setMeasuredHeight, textOf } from '../../data';
import type { ElementRuntime } from '../../elements';
import { stopEditing } from './boardActions';
import { createChildView } from './ColumnChild';
import { enrichElement } from './enrich';
import type { BoardModel } from './model';
import { t } from '../../i18n';

/**
 * Высоту контейнера можно перемерить, когда правят или только что положили его карточку:
 * колонка растёт вместе с ней.
 */
function mayMeasure(model: BoardModel, elementId: string): boolean {
  if (model.shouldMeasure(elementId)) return true;
  const { editingId } = model.interaction.getState();
  if (editingId === null) return false;
  return model.elements.getSnapshot().get(editingId)?.parentId === elementId;
}

/** Связь элементов с открытой доской: текст, отмена, конец правки, высота, вложенные карточки. */
export function createElementRuntime(model: BoardModel): ElementRuntime {
  return {
    textOf: (elementId) => textOf(model.doc, elementId),
    assets: model.host.assets,
    boards: model.host.boards,
    elements: model.elements,
    ChildView: createChildView(model),
    updateData: (elementId, changes) => {
      model.run({
        kind: 'updateElement',
        elementId: elementId as ElementId, // id из снимка доски
        changes: { data: changes },
      });
    },
    ensureText: (elementId, initial) => ensureText(model.doc, elementId, initial),
    stopEditing: () => {
      stopEditing(model);
    },
    fullscreenEditing: window.matchMedia('(max-width: 640px)').matches,
    undo: () => {
      model.undo.undo();
    },
    redo: () => {
      model.undo.redo();
    },
    openAsset: (() => {
      const open = model.host.openAsset;
      if (open === null) return null;
      return (asset: string, mime: string) => {
        open(asset, mime).catch((error: unknown) => {
          console.error('Файл не открылся', error);
          model.showNotice(t('board.notice.openFailed'));
        });
      };
    })(),
    openUrl: (url) => {
      model.host.openUrl(url).catch((error: unknown) => {
        console.error('Ссылка не открылась', error);
        model.showNotice(t('board.notice.openFailed'));
      });
    },
    refresh: (elementId) => {
      void enrichElement(model, elementId);
    },
    reportHeight: (elementId, height) => {
      if (mayMeasure(model, elementId)) setMeasuredHeight(model.doc, elementId, height);
    },
  };
}
