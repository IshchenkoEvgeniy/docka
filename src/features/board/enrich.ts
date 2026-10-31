import { fillElementData } from '../../data';
import { definitionFor } from '../../elements';
import { t } from '../../i18n';
import type { BoardModel } from './model';

/**
 * Данные элемента из сети (превью ссылки, ADR 0005): что подтянуть — решает тип элемента.
 * Пишется без шага отмены: это не действие пользователя.
 */
export async function enrichElement(model: BoardModel, elementId: string): Promise<void> {
  const element = model.elements.getSnapshot().get(elementId);
  const enrich = element === undefined ? null : definitionFor(element.type).enrich;
  if (element === undefined || enrich === null) return;
  const network = model.host.network;
  if (network === null) {
    model.showNotice(t('board.notice.noNetwork'));
    return;
  }
  try {
    const changes = await enrich(element.data, { network, assets: model.host.assets });
    if (changes === null) return;
    const result = fillElementData(model.doc, elementId, changes, model.now());
    if (!result.ok) console.error('Превью не записано', result.error);
  } catch (error: unknown) {
    console.error('Превью не получено', error);
    model.showNotice(t('board.notice.previewFailed'));
  }
}
