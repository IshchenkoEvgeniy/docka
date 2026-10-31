import { GRID_SIZE, type Point } from '../../canvas';
import { t } from '../../i18n';
import type { SharedItem } from '../workspace';
import { createNote } from './boardActions';
import { insertImages, isImageFile } from './images';
import type { BoardModel } from './model';

function toFile(item: Extract<SharedItem, { kind: 'file' }>): File {
  const bytes = Uint8Array.from(atob(item.base64), (char) => char.charCodeAt(0));
  return new File([bytes], item.name, { type: item.mime });
}

/** «Поделиться → Доска»: текст — заметками, картинки — элементами, лесенкой от точки. */
export async function insertShared(
  model: BoardModel,
  items: readonly SharedItem[],
  at: Point,
): Promise<void> {
  const files = items.flatMap((item) => (item.kind === 'file' ? [toFile(item)] : []));
  const images = files.filter(isImageFile);
  items
    .flatMap((item) => (item.kind === 'text' ? [item.text] : []))
    .forEach((text, index) => {
      createNote(model, { x: at.x + index * GRID_SIZE, y: at.y + index * GRID_SIZE }, text);
    });
  if (images.length > 0) await insertImages(model, images, { x: at.x, y: at.y + 2 * GRID_SIZE });
  if (images.length < files.length) model.showNotice(t('board.notice.filesLater'));
}
