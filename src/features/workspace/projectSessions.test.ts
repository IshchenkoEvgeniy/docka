import { describe, expect, it } from 'vitest';
import { beginProjectSession, waitForProjectClosed } from './projectSessions';
import type { AppServices } from './services';

describe('завершение сессии перед удалением проекта', () => {
  it('ждёт все открывающиеся и закрывающиеся сессии нужной папки', async () => {
    const services = {} as AppServices; // Реестр использует только идентичность объекта.
    const first = beginProjectSession(services, 'Игра.doska');
    const second = beginProjectSession(services, 'Игра.doska');
    beginProjectSession(services, 'Сосед.doska');
    let finished = false;
    const waiting = waitForProjectClosed(services, 'Игра.doska').then(() => {
      finished = true;
    });
    first();
    await Promise.resolve();
    expect(finished).toBe(false);
    second();
    await waiting;
    expect(finished).toBe(true);
  });

  it('ошибка закрытия останавливает удаление вместо вечного ожидания или потери данных', async () => {
    const services = {} as AppServices; // Файловая система здесь не используется.
    const finish = beginProjectSession(services, 'Игра.doska');
    finish(new Error('диск недоступен'));
    await expect(waitForProjectClosed(services, 'Игра.doska')).rejects.toThrow('диск недоступен');
  });
});
