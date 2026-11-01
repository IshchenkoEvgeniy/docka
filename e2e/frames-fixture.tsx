import { StrictMode, useSyncExternalStore } from 'react';
import { createRoot } from 'react-dom/client';
import * as Y from 'yjs';
import {
  createManualClock,
  createSequentialIdGenerator,
  plainToRichText,
  type BoardId,
  type NewElement,
} from '../src/core';
import { createBoardElementsStore, executeBoardCommand } from '../src/data';
import { BoardCanvas } from '../src/features/board';
import { NO_HOST } from '../src/features/board/host';
import { downloadFile } from '../src/platform';
import '../src/ui/global.css';
import '../src/ui/tokens.css';

document.documentElement.dataset.theme =
  new URLSearchParams(location.search).get('theme') ?? 'dark';
const doc = new Y.Doc();
const boardId = 'frames-board-0001' as BoardId; // стабильный id тестовой доски
const environment = { clock: createManualClock(1), ids: createSequentialIdGenerator('frames') };
const card = (
  type: string,
  text: string,
  x: number,
  y: number,
  width: number,
  height: number,
): NewElement => ({
  type,
  richText: plainToRichText(text),
  data: {},
  placement: { x, y, width, height },
});
executeBoardCommand(
  doc,
  boardId,
  {
    kind: 'createElements',
    elements: [
      card('frame', 'Персонажи и сюжет', 0, 0, 760, 460),
      card('frame', 'Побочные квесты', 32, 260, 360, 170),
      {
        ...card(
          'note',
          'Смотритель маяка\nЗнает путь к затонувшему городу. Доверяет только старым морякам.',
          40,
          60,
          320,
          140,
        ),
        color: 'yellow',
      },
      card('column', 'Основная линия', 440, 60, 280, 340),
      {
        ...card('note', 'Найти карту\nОбменять компас на сведения о проливе.', 0, 16, 240, 110),
        parentIndex: 3,
      },
      {
        ...card(
          'note',
          'Договориться с капитаном\nВернуть пропавший груз до отплытия.',
          0,
          32,
          240,
          110,
        ),
        parentIndex: 3,
      },
      card('note', 'Письмо домой\nДоставить весточку семье смотрителя.', 56, 300, 300, 100),
      { ...card('frame', 'Локации', 840, 0, 480, 460), color: 'blue' },
      card(
        'note',
        'Северная гавань\nТорговый порт у подножия скал. На рассвете здесь собираются рыбаки.',
        880,
        60,
        360,
        140,
      ),
      {
        ...card(
          'note',
          'Старый маяк\nОгонь погас три ночи назад. На ступенях остались следы соли.',
          880,
          240,
          360,
          130,
        ),
        color: 'yellow',
      },
    ],
  },
  environment,
);
const elements = createBoardElementsStore(doc);
const host = { ...NO_HOST, saveFile: downloadFile };

const labels = { app: 'Доска', board: 'Мир игры' };
function Fixture() {
  const snapshot = useSyncExternalStore(elements.subscribe, elements.getSnapshot);
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <header
        style={{
          display: 'flex',
          gap: 'var(--space-4)',
          padding: 'var(--space-3) var(--space-4)',
          borderBottom: '1px solid var(--color-border)',
        }}
      >
        <strong>{labels.app}</strong>
        <h1 style={{ margin: 0, fontSize: 'var(--font-size-md)', fontWeight: 400 }}>
          {labels.board}
        </h1>
      </header>
      <div style={{ flex: 1, minHeight: 0 }}>
        <BoardCanvas
          doc={doc}
          boardId={boardId}
          environment={environment}
          host={host}
          zoomedOutView="content"
        />
      </div>
      <output hidden data-testid="elements">
        {JSON.stringify([...snapshot.values()].sort((a, b) => a.z - b.z))}
      </output>
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
