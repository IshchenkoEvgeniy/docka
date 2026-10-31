import { useEffect } from 'react';
import type { CameraControls, Point } from '../../canvas';
import { t } from '../../i18n';
import { isEditableTarget } from '../../ui';
import { copySelection, createNote, deleteSelection } from './boardActions';
import { CLIPBOARD_MIME, appClipboard, serializePayload } from './clipboard';
import { insertImages, isImageFile } from './images';
import type { BoardModel } from './model';
import { applyPaste, resolvePaste } from './pasting';
import { worldPoint } from './view';

const TEXT_FILE = /\.(txt|md|markdown)$/i;

function localPoint(controls: CameraControls, event: { clientX: number; clientY: number }): Point {
  const rect = controls.containerRef.current?.getBoundingClientRect();
  return rect === undefined
    ? { x: 0, y: 0 }
    : { x: event.clientX - rect.left, y: event.clientY - rect.top };
}

/** Картинки — элементами «Изображение», текстовые файлы — заметками; прочие — позже (вложения). */
async function dropFiles(model: BoardModel, files: readonly File[], at: Point): Promise<void> {
  let skipped = false;
  const images = files.filter(isImageFile);
  if (images.length > 0) await insertImages(model, images, at);
  for (const [index, file] of files.filter((item) => !isImageFile(item)).entries()) {
    if (!file.type.startsWith('text/') && !TEXT_FILE.test(file.name)) {
      skipped = true;
      continue;
    }
    const text = await file.text();
    createNote(model, { x: at.x + index * 24, y: at.y + index * 24 }, text);
  }
  if (skipped) model.showNotice(t('board.notice.filesLater'));
}

function attachClipboard(model: BoardModel, controls: CameraControls, pointer: () => Point | null) {
  const onCopy = (event: ClipboardEvent, cut: boolean): void => {
    if (isEditableTarget(event.target) || event.clipboardData === null) return;
    const content = copySelection(model);
    if (content === null) return;
    event.preventDefault();
    event.clipboardData.setData('text/plain', content.plainText);
    event.clipboardData.setData(CLIPBOARD_MIME, serializePayload(content.payload));
    appClipboard.setState({ content });
    if (cut) deleteSelection(model);
  };
  const copy = (event: ClipboardEvent): void => {
    onCopy(event, false);
  };
  const cut = (event: ClipboardEvent): void => {
    onCopy(event, true);
  };
  const paste = (event: ClipboardEvent): void => {
    if (isEditableTarget(event.target) || event.clipboardData === null) return;
    event.preventDefault();
    const data = event.clipboardData;
    const files = [...data.files];
    const at = worldPoint(controls, pointer());
    if (files.length > 0) {
      void dropFiles(model, files, at);
      return;
    }
    const resolved = resolvePaste(
      data.getData(CLIPBOARD_MIME),
      data.getData('text/plain'),
      appClipboard.getState().content,
    );
    applyPaste(model, resolved, at);
  };
  document.addEventListener('copy', copy);
  document.addEventListener('cut', cut);
  document.addEventListener('paste', paste);
  return () => {
    document.removeEventListener('copy', copy);
    document.removeEventListener('cut', cut);
    document.removeEventListener('paste', paste);
  };
}

function attachDrop(model: BoardModel, controls: CameraControls, container: HTMLElement) {
  const onDragOver = (event: DragEvent): void => {
    event.preventDefault();
    if (event.dataTransfer !== null) event.dataTransfer.dropEffect = 'copy';
  };
  const onDrop = (event: DragEvent): void => {
    event.preventDefault();
    const data = event.dataTransfer;
    if (data === null) return;
    const at = worldPoint(controls, localPoint(controls, event));
    const files = [...data.files];
    if (files.length > 0) void dropFiles(model, files, at);
    else applyPaste(model, resolvePaste('', data.getData('text/plain'), null), at);
  };
  container.addEventListener('dragover', onDragOver);
  container.addEventListener('drop', onDrop);
  return () => {
    container.removeEventListener('dragover', onDragOver);
    container.removeEventListener('drop', onDrop);
  };
}

/** Копирование, вырезание, вставка (Ctrl+C/X/V) и перетаскивание текста и файлов на доску. */
export function useClipboardEvents(
  model: BoardModel,
  controls: CameraControls,
  pointer: () => Point | null,
): void {
  useEffect(() => {
    const container = controls.containerRef.current;
    const detachClipboard = attachClipboard(model, controls, pointer);
    const detachDrop =
      container === null ? () => undefined : attachDrop(model, controls, container);
    return () => {
      detachClipboard();
      detachDrop();
    };
  }, [model, controls, pointer]);
}
