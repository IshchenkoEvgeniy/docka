import {
  BoardIdSchema,
  createManualClock,
  createMemoryFileSystem,
  createSequentialIdGenerator,
  plainToRichText,
  type BoardId,
} from '../src/core';
import {
  createAssetStore,
  createProject,
  executeBoardCommand,
  executeProjectCommand,
} from '../src/data';
import { createBoardDirectory } from '../src/features/project/boardDirectory';

export const environment = {
  clock: createManualClock(1),
  ids: createSequentialIdGenerator('preview'),
};
const fs = createMemoryFileSystem();
const result = await createProject(
  { ...environment, fs, deviceId: 'preview-device' },
  'Проект игры',
);
if (!result.ok) throw new Error(result.error);
export const project = result.value;
export const rootId = project.meta.rootBoardId;
export const names = ['НПС', 'Локации', 'Предметы', 'Квесты', 'ГДД', 'Механики'];
export const children: BoardId[] = [];
export const directory = createBoardDirectory(project.projectDoc.doc);
export const assets = createAssetStore(fs);
const graphic =
  '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="160"><rect width="400" height="160" fill="#24344f"/><path d="M0 160 100 30 200 160 290 50 400 160" fill="#6b9cf0"/><circle cx="330" cy="32" r="16" fill="#fff4c2"/></svg>';
const asset = await assets.put(new TextEncoder().encode(graphic), 'image/svg+xml');
if (!asset.ok) throw new Error(asset.error);

for (const [index, name] of names.entries()) {
  const created = executeProjectCommand(
    project.projectDoc.doc,
    { kind: 'createBoard', parentId: rootId, title: name },
    environment,
  );
  if (!created.ok) throw new Error(created.error);
  const id = BoardIdSchema.parse(created.value.createdId);
  children.push(id);
  const board = await project.openBoard(id);
  if (index === 5) continue;
  executeBoardCommand(
    board.doc,
    id,
    {
      kind: 'createElements',
      elements: [
        {
          type: 'note',
          placement: { x: 0, y: 0, width: 200, height: 110 },
          color: 'yellow',
          data: {},
          richText: plainToRichText(`${name}\nИдеи, связи и описание проекта`),
        },
        {
          type: 'note',
          placement: { x: 240, y: 0, width: 160, height: 80 },
          color: 'green',
          data: {},
          richText: plainToRichText('Задачи\nСобрать референсы\nУточнить детали'),
        },
        {
          type: 'image',
          placement: { x: 0, y: 150, width: 400, height: 160 },
          data: {
            asset: asset.value,
            naturalWidth: 400,
            naturalHeight: 160,
            name: 'Референс локации',
          },
        },
      ],
    },
    environment,
  );
}
const root = await project.openBoard(rootId);
executeBoardCommand(
  root.doc,
  rootId,
  {
    kind: 'createElements',
    elements: children.map((id, index) => ({
      type: 'board',
      data: { boardId: id },
      placement: {
        x: (index % 3) * 288,
        y: Math.floor(index / 3) * 248,
        width: index === 5 ? 160 : 240,
        height: index === 5 ? 150 : 200,
      },
    })),
  },
  environment,
);
// Ссылка ребёнка обратно на родителя не должна создавать рекурсивные миниатюры.
const child = await project.openBoard(children[0] ?? rootId);
executeBoardCommand(
  child.doc,
  children[0] ?? rootId,
  {
    kind: 'createElement',
    type: 'board',
    data: { boardId: rootId },
    placement: { x: 450, y: 0, width: 160, height: 150 },
  },
  environment,
);

export async function addCard() {
  const id = children[0];
  const board = await project.openBoard(id);
  executeBoardCommand(
    board.doc,
    id,
    {
      kind: 'createElement',
      type: 'note',
      data: {},
      placement: { x: 450, y: 180, width: 160, height: 80 },
      richText: plainToRichText('Новый персонаж'),
    },
    environment,
  );
}

export function renameBoard() {
  const id = children[0];
  executeProjectCommand(
    project.projectDoc.doc,
    { kind: 'updateBoard', boardId: id, changes: { title: 'Персонажи' } },
    environment,
  );
}
