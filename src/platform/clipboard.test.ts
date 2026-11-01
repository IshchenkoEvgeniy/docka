import { afterEach, describe, expect, it, vi } from 'vitest';
import { androidClipboardReader, readBrowserClipboard } from './clipboard';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

function android(read: (id: string, target: EventTarget) => void) {
  const target = new EventTarget();
  Object.assign(target, {
    DoskaAndroid: {
      readClipboard: (id: string) => {
        read(id, target);
      },
    },
  });
  vi.stubGlobal('window', target);
  const reader = androidClipboardReader();
  if (reader === null) throw new Error('Нет моста');
  return reader;
}

describe('системный буфер', () => {
  it('Android: декодирует изображение content provider и не принимает чужой ответ', async () => {
    const read = android((id, target) => {
      target.dispatchEvent(
        new CustomEvent('doska-clipboard-result', { detail: { id: 'other', items: [] } }),
      );
      target.dispatchEvent(
        new CustomEvent('doska-clipboard-result', {
          detail: {
            id,
            items: [{ kind: 'file', name: 'photo.png', mime: 'image/png', base64: 'AQID' }],
          },
        }),
      );
    });
    expect(await read()).toEqual({
      text: '',
      files: [{ name: 'photo.png', mime: 'image/png', bytes: new Uint8Array([1, 2, 3]) }],
    });
  });

  it('Android: ошибки разрешений не превращаются в пустую успешную вставку', async () => {
    const read = android((id, target) => {
      target.dispatchEvent(
        new CustomEvent('doska-clipboard-result', { detail: { id, error: 'permission denied' } }),
      );
    });
    await expect(read()).rejects.toThrow('permission denied');
  });

  it('Android: ограничивает ожидание и снимает обработчик ответа', async () => {
    vi.useFakeTimers();
    const read = android(() => undefined);
    const rejected = expect(read()).rejects.toThrow('timed out');
    await vi.advanceTimersByTimeAsync(15_000);
    await rejected;
    expect(vi.getTimerCount()).toBe(0);
  });

  it('браузер: читает картинку, даже когда на клипе есть также текст', async () => {
    const getType = vi.fn(() =>
      Promise.resolve(new Blob([new Uint8Array([1, 2])], { type: 'image/png' })),
    );
    vi.stubGlobal('navigator', {
      clipboard: { read: () => Promise.resolve([{ types: ['text/plain', 'image/png'], getType }]) },
    });
    const result = await readBrowserClipboard();
    expect(result.files[0]?.bytes).toEqual(new Uint8Array([1, 2]));
    expect(getType).toHaveBeenCalledWith('image/png');
  });

  it('старый браузер: оставляет текстовую вставку рабочей', async () => {
    vi.stubGlobal('navigator', { clipboard: { readText: () => Promise.resolve('Текст') } });
    expect(await readBrowserClipboard()).toEqual({ text: 'Текст', files: [] });
  });
});
