import { StrictMode, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { BoardCanvas, type BoardHost } from '../src/features/board';
import { NO_HOST } from '../src/features/board/host';
import { createLinkedBoardPreview } from '../src/features/project/linkedBoardPreview';
import { useBoardDocument } from '../src/features/project/useOpenProject';
import { downloadFile, readSystemClipboard } from '../src/platform';
import {
  assets,
  directory,
  project,
  rootId,
  environment,
  addCard,
  renameBoard,
} from './previewData';
import '../src/ui/global.css';
import '../src/ui/tokens.css';

document.documentElement.dataset.theme =
  new URLSearchParams(location.search).get('theme') ?? 'dark';
const Preview = createLinkedBoardPreview({ project, assets, boards: directory });
const labels = {
  back: 'На главную доску',
  add: 'Добавить карточку НПС',
  rename: 'Переименовать НПС',
  current: 'Текущая доска',
};

function Fixture() {
  const [boardId, setBoardId] = useState(rootId);
  const document = useBoardDocument(project, boardId);
  const host = useMemo<BoardHost>(
    () => ({
      ...NO_HOST,
      saveFile: downloadFile,
      readClipboard: readSystemClipboard,
      assets,
      boards: directory,
      BoardPreview: Preview,
      openBoard: setBoardId,
    }),
    [],
  );
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-4)',
          padding: 'var(--space-3)',
        }}
      >
        <button
          onClick={() => {
            setBoardId(rootId);
          }}
        >
          {labels.back}
        </button>
        <button onClick={() => void addCard()}>{labels.add}</button>
        <button onClick={renameBoard}>{labels.rename}</button>
        <span aria-label={labels.current}>{directory.get(boardId)?.title}</span>
      </header>
      <div style={{ flex: 1, minHeight: 0 }}>
        {document.status === 'ready' && (
          <BoardCanvas
            key={boardId}
            boardId={boardId}
            doc={document.value.doc}
            environment={environment}
            host={host}
            zoomedOutView="content"
          />
        )}
      </div>
    </div>
  );
}

const root = document.getElementById('root');
if (root === null) throw new Error('Нет root');
createRoot(root).render(
  <StrictMode>
    <Fixture />
  </StrictMode>,
);
