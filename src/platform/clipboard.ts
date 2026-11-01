import { z } from 'zod';
import type { ClipboardReader, SystemClipboard } from '../core';

const AndroidClipboardSchema = z.object({
  id: z.string(),
  changedAt: z.number().nonnegative().optional(),
  error: z.string().optional(),
  items: z
    .array(
      z.discriminatedUnion('kind', [
        z.object({ kind: z.literal('text'), text: z.string() }),
        z.object({
          kind: z.literal('file'),
          name: z.string(),
          mime: z.string(),
          base64: z.string(),
        }),
      ]),
    )
    .default([]),
});

function decodeAndroid(data: z.infer<typeof AndroidClipboardSchema>): SystemClipboard {
  return {
    ...(data.changedAt === undefined ? {} : { changedAt: data.changedAt }),
    text: data.items.flatMap((item) => (item.kind === 'text' ? [item.text] : [])).join('\n'),
    files: data.items.flatMap((item) =>
      item.kind === 'file'
        ? [
            {
              name: item.name,
              mime: item.mime,
              bytes: Uint8Array.from(atob(item.base64), (char) => char.charCodeAt(0)),
            },
          ]
        : [],
    ),
  };
}

/** Ответ нативного Android приходит асинхронно с UI-потока, по id запроса. */
export function androidClipboardReader(): ClipboardReader | null {
  const bridge: unknown = Reflect.get(window, 'DoskaAndroid');
  const read: unknown =
    typeof bridge === 'object' && bridge !== null ? Reflect.get(bridge, 'readClipboard') : null;
  if (typeof read !== 'function') return null;
  return () =>
    new Promise<SystemClipboard>((resolve, reject) => {
      const id = crypto.randomUUID();
      const clean = (): void => {
        clearTimeout(timer);
        window.removeEventListener('doska-clipboard-result', result);
      };
      const result = (event: Event): void => {
        if (!(event instanceof CustomEvent)) return;
        const parsed = AndroidClipboardSchema.safeParse(event.detail);
        if (!parsed.success || parsed.data.id !== id) return;
        clean();
        if (parsed.data.error !== undefined) {
          reject(new Error(parsed.data.error));
          return;
        }
        try {
          resolve(decodeAndroid(parsed.data));
        } catch (error: unknown) {
          reject(error instanceof Error ? error : new Error(String(error)));
        }
      };
      const timer = setTimeout(() => {
        clean();
        reject(new Error('Clipboard request timed out'));
      }, 15_000);
      window.addEventListener('doska-clipboard-result', result);
      try {
        // У Java-объекта нет обычного JS-прототипа; сигнатура проверена наличием метода выше.
        (read as (this: unknown, id: string) => void).call(bridge, id);
      } catch (error: unknown) {
        clean();
        reject(error instanceof Error ? error : new Error(String(error)));
      }
    });
}

/** Сначала изображение; текст — для обычной вставки и сверки с внутренним буфером карточек. */
export async function readBrowserClipboard(): Promise<SystemClipboard> {
  const clipboard = Reflect.get(navigator, 'clipboard') as Clipboard | undefined; // Стандартное DOM-свойство может отсутствовать в WebView.
  if (clipboard === undefined) throw new Error('Clipboard API unavailable');
  if (typeof clipboard.read !== 'function') return { text: await clipboard.readText(), files: [] };
  const items = await clipboard.read();
  const files: SystemClipboard['files'][number][] = [];
  const text: string[] = [];
  for (const item of items) {
    const mime = item.types.find((type) => type.startsWith('image/'));
    if (mime !== undefined)
      files.push({
        name: 'clipboard-image',
        mime,
        bytes: new Uint8Array(await (await item.getType(mime)).arrayBuffer()),
      });
    else if (item.types.includes('text/plain'))
      text.push(await (await item.getType('text/plain')).text());
  }
  return { text: text.join('\n'), files };
}

export const readSystemClipboard: ClipboardReader = () =>
  (androidClipboardReader() ?? readBrowserClipboard)();
