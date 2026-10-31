import { createContext, useContext } from 'react';
import { useStore } from 'zustand';
import type { Workspace, WorkspaceState } from './workspace';

export const WorkspaceContext = createContext<Workspace | null>(null);

export function useWorkspace(): Workspace {
  const workspace = useContext(WorkspaceContext);
  if (workspace === null) throw new Error('useWorkspace вне WorkspaceContext');
  return workspace;
}

export function useWorkspaceState<T>(selector: (state: WorkspaceState) => T): T {
  return useStore(useWorkspace().store, selector);
}
