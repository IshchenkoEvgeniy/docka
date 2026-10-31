import { GRID_SIZE, type Point } from '../../canvas';
import { IMAGE_TYPES } from '../../data';
import { t } from '../../i18n';
import type { BoardModel } from './model';

/** Картинка на доске не шире этого: большие фото не закрывают всю доску. */
const MAX_INITIAL_WIDTH = 480;

export function isImageFile(file: File): boolean {
  return IMAGE_TYPES[file.type] !== undefined;
}

async function naturalSize(file: File): Promise<{ width: number; height: number }> {
  try {
    const bitmap = await createImageBitmap(file);
    const size = { width: bitmap.width, height: bitmap.height };
    bitmap.close();
    return size;
  } catch {
    // SVG без размеров и редкие форматы: квадрат по умолчанию.
    return { width: 400, height: 400 };
  }
}

/** Кладёт картинки в проект и ставит их на доску лесенкой от точки at. */
export async function insertImages(
  model: BoardModel,
  files: readonly File[],
  at: Point,
): Promise<void> {
  const assets = model.host.assets;
  if (assets === null) {
    model.showNotice(t('board.notice.noProjectFiles'));
    return;
  }
  const elements = [];
  for (const [index, file] of files.entries()) {
    const stored = await assets.put(new Uint8Array(await file.arrayBuffer()), file.type);
    if (!stored.ok) {
      model.showNotice(stored.error);
      continue;
    }
    const natural = await naturalSize(file);
    const width = Math.min(MAX_INITIAL_WIDTH, natural.width);
    const height = Math.max(1, Math.round((width * natural.height) / natural.width));
    elements.push({
      type: 'image',
      placement: {
        x: Math.round(at.x - width / 2 + index * GRID_SIZE),
        y: Math.round(at.y - height / 2 + index * GRID_SIZE),
        width,
        height,
      },
      data: {
        asset: stored.value,
        naturalWidth: natural.width,
        naturalHeight: natural.height,
        name: file.name.slice(0, 260),
      },
    });
  }
  if (elements.length === 0) return;
  const result = model.run({ kind: 'createElements', elements });
  if (result?.createdIds !== undefined)
    model.interaction.setState({ selection: new Set(result.createdIds) });
}
