import { useEffect } from 'react';
import { useWorkspace, useWorkspaceState } from './context';
import type { Route } from './workspace';

function isRoute(value: unknown): value is Route {
  if (typeof value !== 'object' || value === null) return false;
  const screen = (value as { screen?: unknown }).screen;
  return screen === 'home' || screen === 'settings' || screen === 'project';
}

const sameRoute = (a: unknown, b: Route) => JSON.stringify(a) === JSON.stringify(b);

/**
 * Экраны — записи истории: кнопка «Назад» телефона и мыши возвращает на предыдущий экран,
 * а не закрывает приложение.
 */
export function useHistorySync(): void {
  const workspace = useWorkspace();
  const route = useWorkspaceState((state) => state.route);
  useEffect(() => {
    const state: unknown = window.history.state;
    if (sameRoute(state, route)) return;
    if (route.screen === 'home' && !isRoute(state)) window.history.replaceState(route, '');
    else window.history.pushState(route, '');
  }, [route]);
  useEffect(() => {
    const onPop = (event: PopStateEvent): void => {
      const state: unknown = event.state;
      workspace.restoreRoute(isRoute(state) ? state : { screen: 'home' });
    };
    window.addEventListener('popstate', onPop);
    return () => {
      window.removeEventListener('popstate', onPop);
    };
  }, [workspace]);
}

/** «Поделиться → Доска»: забирает полученное при запуске, по событию Android и при возврате. */
export function useSharedInbox(): void {
  const workspace = useWorkspace();
  useEffect(() => {
    const { services } = workspace;
    const pump = (): void => {
      workspace.addToInbox(services.takeShared());
    };
    pump();
    const stop = services.onShared(pump);
    window.addEventListener('focus', pump);
    return () => {
      stop();
      window.removeEventListener('focus', pump);
    };
  }, [workspace]);
}
