import { useSyncExternalStore } from 'react';
import { createRoot } from 'react-dom/client';
import * as Y from 'yjs';
import {
  createManualClock,
  createMemoryFileSystem,
  createSequentialIdGenerator,
  plainToRichText,
  type BoardId,
} from '../src/core';
import { createAssetStore, createBoardElementsStore, executeBoardCommand } from '../src/data';
import { BoardCanvas } from '../src/features/board';
import { NO_HOST } from '../src/features/board/host';
import '../src/ui/global.css';
import '../src/ui/tokens.css';

document.documentElement.dataset.theme =
  new URLSearchParams(location.search).get('theme') ?? 'dark';
const doc = new Y.Doc();
const boardId = 'resize-board-0001' as BoardId; // стабильный id тестовой доски
const environment = { clock: createManualClock(1), ids: createSequentialIdGenerator('resize') };
const assets = createAssetStore(createMemoryFileSystem());
const graphic =
  '<svg xmlns="http://www.w3.org/2000/svg" width="300" height="200"><rect width="300" height="200" fill="#24344f"/><path d="M0 200 100 30 200 200 260 100 300 200" fill="#6b9cf0"/></svg>';
const asset = await assets.put(new TextEncoder().encode(graphic), 'image/svg+xml');
if (!asset.ok) throw new Error(asset.error);
const host = { ...NO_HOST, assets };
executeBoardCommand(
  doc,
  boardId,
  {
    kind: 'createElements',
    elements: [
      {
        type: 'shape',
        data: { shape: 'rectangle' },
        richText: plainToRichText('Фигура'),
        placement: { x: 80, y: 100, width: 300, height: 200 },
      },
      {
        type: 'image',
        data: { asset: asset.value, naturalWidth: 300, naturalHeight: 200 },
        placement: { x: 500, y: 100, width: 300, height: 200 },
      },
      {
        type: 'note',
        data: {},
        richText: plainToRichText('Заметка'),
        placement: { x: 80, y: 420, width: 300, height: 120 },
      },
    ],
  },
  environment,
);
const elements = createBoardElementsStore(doc);
const cameraMemory = { initial: { offsetX: 40, offsetY: 40, zoom: 1 }, onChange: () => undefined };

function Fixture() {
  const snapshot = useSyncExternalStore(elements.subscribe, elements.getSnapshot);
  return (
    <>
      <BoardCanvas
        doc={doc}
        boardId={boardId}
        environment={environment}
        camera={cameraMemory}
        host={host}
        zoomedOutView="content"
      />
      <output hidden data-testid="elements">
        {JSON.stringify([...snapshot.values()].sort((a, b) => a.z - b.z))}
      </output>
    </>
  );
}
const root = document.getElementById('root');
if (root === null) throw new Error('Нет root');
createRoot(root).render(<Fixture />);
