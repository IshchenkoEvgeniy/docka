import { useEffect, useMemo } from 'react';
import type { Board } from '../../core';
import type { OpenProject } from '../../data';
import { t } from '../../i18n';
import { BoardCanvas, type BoardCameraMemory, type BoardHost } from '../board';
import { useWorkspace, useWorkspaceState } from '../workspace';
import { createBoardDirectory } from './boardDirectory';
import { Message } from './ProjectParts';
import { useBoardDocument } from './useOpenProject';

/** Открытая доска проекта: документ, камера этого устройства, вид при отдалении. */
export function BoardArea({
  project,
  board,
  host,
}: {
  readonly project: OpenProject;
  readonly board: Board;
  readonly host: BoardHost;
}) {
  const workspace = useWorkspace();
  const { services, cameras } = workspace;
  const document = useBoardDocument(project, board.id);
  const zoomedOutView = useWorkspaceState((state) => state.settings.zoomedOutView);
  const environment = useMemo(() => ({ clock: services.clock, ids: services.ids }), [services]);
  const projectId = project.meta.id;
  const camera = useMemo<BoardCameraMemory>(
    () => ({
      initial: cameras.get(projectId, board.id),
      onChange: (value) => {
        cameras.set(projectId, board.id, value);
      },
    }),
    [cameras, projectId, board.id],
  );
  if (document.status !== 'ready')
    return <Message text={document.status === 'error' ? document.error : t('project.loading')} />;
  return (
    <BoardCanvas
      key={board.id}
      doc={document.value.doc}
      boardId={board.id}
      environment={environment}
      camera={camera}
      host={host}
      background={board.background}
      zoomedOutView={zoomedOutView}
    />
  );
}

export function useBoardDirectory(project: OpenProject) {
  const directory = useMemo(() => createBoardDirectory(project.projectDoc.doc), [project]);
  useEffect(
    () => () => {
      directory.destroy();
    },
    [directory],
  );
  return directory;
}
