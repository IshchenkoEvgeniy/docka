import { GRID_SIZE, type Point } from '../../canvas';
import type { NewElement } from '../../core';
import { definitionForFile } from '../../elements';
import { t } from '../../i18n';
import { insertImages, isImageFile } from './images';
import type { BoardModel } from './model';

/**
 * Файлы на доску: картинки — изображениями, остальное — элементом, который берёт этот тип
 * файла (видео и звук — плеером, прочее — карточкой файла). Файл кладётся в assets/ проекта.
 */
export async function insertFiles(model: BoardModel, files: readonly File[], at: Point) {
  const images = files.filter(isImageFile);
  if (images.length > 0) await insertImages(model, images, at);
  const others = files.filter((file) => !isImageFile(file));
  const assets = model.host.assets;
  if (others.length === 0) return;
  if (assets === null) {
    model.showNotice(t('board.notice.noProjectFiles'));
    return;
  }
  const elements: NewElement[] = [];
  for (const [index, file] of others.entries()) {
    const mime = file.type === '' ? 'application/octet-stream' : file.type;
    const definition = definitionForFile(mime);
    const fromFile = definition?.fromFile ?? null;
    if (definition === null || fromFile === null) continue;
    const stored = await assets.put(new Uint8Array(await file.arrayBuffer()), mime, file.name);
    if (!stored.ok) {
      model.showNotice(stored.error);
      continue;
    }
    const draft = fromFile.create({
      asset: stored.value,
      name: file.name.slice(0, 260),
      mime,
      size: file.size,
    });
    const shift = (images.length + index) * GRID_SIZE;
    elements.push({
      type: definition.type,
      placement: {
        x: Math.round(at.x - draft.width / 2 + shift),
        y: Math.round(at.y - draft.height / 2 + shift),
        width: draft.width,
        height: draft.height,
      },
      data: draft.data,
    });
  }
  if (elements.length === 0) return;
  const result = model.run({ kind: 'createElements', elements });
  if (result?.createdIds !== undefined)
    model.interaction.setState({ selection: new Set(result.createdIds) });
}
