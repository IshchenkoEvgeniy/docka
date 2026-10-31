import { GRID_SIZE, type Point } from '../../canvas';
import type { SharedItem } from '../workspace';
import { createFromText, createNote } from './boardActions';
import { insertFiles } from './files';
import type { BoardModel } from './model';

function toFile(item: Extract<SharedItem, { kind: 'file' }>): File {
  const bytes = Uint8Array.from(atob(item.base64), (char) => char.charCodeAt(0));
  return new File([bytes], item.name, { type: item.mime });
}

/** «Поделиться → Доска»: ссылки — карточками ссылок, текст — заметками, файлы — элементами. */
export async function insertShared(
  model: BoardModel,
  items: readonly SharedItem[],
  at: Point,
): Promise<void> {
  const files = items.flatMap((item) => (item.kind === 'file' ? [toFile(item)] : []));
  items
    .flatMap((item) => (item.kind === 'text' ? [item.text] : []))
    .forEach((text, index) => {
      const point = { x: at.x + index * GRID_SIZE, y: at.y + index * GRID_SIZE };
      if (!createFromText(model, text, point)) createNote(model, point, text);
    });
  if (files.length > 0) await insertFiles(model, files, { x: at.x, y: at.y + 2 * GRID_SIZE });
}
