import { samePath } from '../../data';
import type { AppServices } from './services';

interface Session {
  readonly folder: string;
  readonly closed: Promise<void>;
  error: unknown;
}
const active = new WeakMap<AppServices, Set<Session>>();

/** Регистрируется до асинхронного открытия: даже быстро закрытая загрузка должна завершиться. */
export function beginProjectSession(
  services: AppServices,
  folder: string,
): (error?: unknown) => void {
  const sessions = active.get(services) ?? new Set<Session>();
  active.set(services, sessions);
  let finish = (): void => undefined;
  const closed = new Promise<void>((resolve) => {
    finish = resolve;
  });
  const session: Session = { folder, closed, error: null };
  sessions.add(session);
  return (error) => {
    session.error = error ?? null;
    if (session.error === null) sessions.delete(session);
    finish();
  };
}

export async function waitForProjectClosed(services: AppServices, folder: string): Promise<void> {
  const sessions = [...(active.get(services) ?? [])].filter((item) =>
    samePath(item.folder, folder),
  );
  await Promise.all(sessions.map((item) => item.closed));
  const failed = sessions.find((item) => item.error !== null);
  if (failed !== undefined) throw new Error(`Не удалось закрыть проект: ${String(failed.error)}`);
}
