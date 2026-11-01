import type { Point } from '../../canvas';
import type { SystemClipboard } from '../../core';
import { t } from '../../i18n';
import { createFromText, createNote, pastePayload, stopEditing } from './boardActions';
import { insertFiles } from './files';
import { appClipboard, parsePayload, type ClipboardContent } from './clipboard';
import type { BoardModel } from './model';

/** Что вставить из системного буфера: свой формат, наш же текст (система потеряла формат) или чужой текст. */
export function resolvePaste(
  json: string,
  text: string,
  remembered: ClipboardContent | null,
):
  | { kind: 'elements'; content: ClipboardContent['payload'] }
  | { kind: 'text'; text: string }
  | null {
  const payload = parsePayload(json);
  if (payload !== null) return { kind: 'elements', content: payload };
  if (remembered !== null && text !== '' && text === remembered.plainText)
    return { kind: 'elements', content: remembered.payload };
  if (text.trim() !== '') return { kind: 'text', text };
  return null;
}

export function applyPaste(
  model: BoardModel,
  resolved: ReturnType<typeof resolvePaste>,
  at: Point,
): void {
  if (resolved === null) model.showNotice(t('board.notice.nothingToPaste'));
  else if (resolved.kind === 'elements') pastePayload(model, resolved.content, at);
  // Ссылка — карточкой ссылки, текст из Excel — таблицей, остальное — заметкой.
  else if (!createFromText(model, resolved.text, at)) createNote(model, at, resolved.text);
}

/**
 * Кнопка и меню работают без события paste, в том числе с Android content:// изображениями.
 */
export async function pasteFromApp(model: BoardModel, at: Point): Promise<void> {
  const { content: remembered, copiedAt } = appClipboard.getState();
  let content: SystemClipboard;
  try {
    if (model.host.readClipboard === null) throw new Error('Clipboard unavailable');
    content = await model.host.readClipboard();
  } catch (error: unknown) {
    if (remembered !== null) pastePayload(model, remembered.payload, at);
    else {
      console.error('Буфер обмена не прочитан', error);
      model.showNotice(t('board.notice.clipboardUnavailable'));
    }
    return;
  }
  try {
    // Копирование через меню не пишет в ОС: более старая системная запись не должна его вытеснять.
    if (
      remembered !== null &&
      (content.changedAt === undefined ? content.files.length === 0 : content.changedAt <= copiedAt)
    ) {
      pastePayload(model, remembered.payload, at);
      return;
    }
    if (content.files.length > 0) {
      stopEditing(model);
      await insertFiles(
        model,
        content.files.map(
          (file) => new File([new Uint8Array(file.bytes)], file.name, { type: file.mime }),
        ),
        at,
      );
    } else applyPaste(model, resolvePaste('', content.text, remembered), at);
  } catch (error: unknown) {
    console.error('Содержимое буфера не вставлено', error);
    model.showNotice(t('board.notice.pasteFailed', { error: String(error) }));
  }
}
