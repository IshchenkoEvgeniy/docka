import { createRoot } from 'react-dom/client';
import * as Y from 'yjs';
import {
  BoardIdSchema,
  createManualClock,
  createSequentialIdGenerator,
  plainToRichText,
  type BoardCommand,
  type ElementId,
} from '../src/core';
import { executeBoardCommand } from '../src/data';
import { BoardCanvas } from '../src/features/board';
import { NO_HOST } from '../src/features/board/host';
import { downloadFile } from '../src/platform';
import '../src/ui/global.css';
import '../src/ui/tokens.css';

document.documentElement.dataset.theme =
  new URLSearchParams(location.search).get('theme') ?? 'light';
const environment = { clock: createManualClock(1), ids: createSequentialIdGenerator('fixture') };
const doc = new Y.Doc();
const boardId = BoardIdSchema.parse('board-mindmap');

function run(command: BoardCommand): ElementId {
  const result = executeBoardCommand(doc, boardId, command, environment);
  if (!result.ok) throw new Error(result.error);
  return (result.value.createdId ?? '') as ElementId; // id новой карточки
}

const note = (text: string) => ({
  type: 'note',
  placement: { x: 0, y: 0, width: 200, height: 48 },
  data: {},
  richText: plainToRichText(text),
});

const root = run({ kind: 'createElement', ...note('Квест: пропавший кузнец'), color: 'blue' });
run({ kind: 'makeMindMapRoot', elementId: root, direction: 'both' });
const branch = (anchorId: ElementId, text: string, relation: 'child' | 'sibling' = 'child') =>
  run({ kind: 'addMindMapNode', anchorId, relation, element: note(text) });
const tavern = branch(root, 'Таверна');
branch(tavern, 'Расспросить трактирщика');
branch(tavern, 'Подслушать стражу');
const forge = branch(root, 'Кузница');
branch(forge, 'Следы борьбы');
const mine = branch(root, 'Старая шахта');
branch(mine, 'Засада гоблинов');
branch(mine, 'Кузнец в клетке');
run({ kind: 'setMindMapCollapsed', elementId: forge, collapsed: true });

const container = document.getElementById('root');
if (container === null) throw new Error('Нет #root');
createRoot(container).render(
  <BoardCanvas
    boardId={boardId}
    doc={doc}
    environment={environment}
    host={{ ...NO_HOST, saveFile: downloadFile }}
    zoomedOutView="content"
  />,
);
