import type { Point } from '../../canvas';
import { t } from '../../i18n';
import { createNote, pastePayload } from './boardActions';
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
  else createNote(model, at, resolved.text);
}

/**
 * Вставка из меню: у меню нет события paste. Сначала скопированное в приложении,
 * иначе текст из системного буфера (может быть недоступен — тогда сообщение).
 */
export async function pasteFromApp(model: BoardModel, at: Point): Promise<void> {
  const remembered = appClipboard.getState().content;
  if (remembered !== null) {
    pastePayload(model, remembered.payload, at);
    return;
  }
  const text = await navigator.clipboard.readText().catch(() => '');
  applyPaste(model, resolvePaste('', text, null), at);
}
