import { createRoot } from 'react-dom/client';
import * as Y from 'yjs';
import {
  BoardIdSchema,
  EntitySchema,
  EntityTypeSchema,
  createManualClock,
  createMemoryFileSystem,
  createSequentialIdGenerator,
  plainToRichText,
} from '../src/core';
import {
  createAssetStore,
  createBoardElementsStore,
  createBoardConnectionsStore,
  executeBoardCommand,
  textOf,
} from '../src/data';
import { EntityContext, definitionFor, elementTypes, type ElementRuntime } from '../src/elements';
import { PngExportDialog } from '../src/features/export';
import { downloadFile } from '../src/platform';
import '../src/ui/global.css';
import '../src/ui/tokens.css';

document.documentElement.dataset.theme =
  new URLSearchParams(location.search).get('theme') ?? 'light';
const environment = { clock: createManualClock(1), ids: createSequentialIdGenerator('fixture') };
const doc = new Y.Doc();
const boardId = BoardIdSchema.parse('board-fixture');
const assets = createAssetStore(createMemoryFileSystem());
const canvas = document.createElement('canvas');
canvas.width = 64;
canvas.height = 64;
const context = canvas.getContext('2d');
if (context === null) throw new Error('Нет Canvas');
context.fillStyle = '#ff0000';
context.fillRect(0, 0, 64, 64);
const png = await new Promise<Blob>((resolve, reject) => {
  canvas.toBlob((blob) => {
    if (blob === null) reject(new Error('Нет PNG'));
    else resolve(blob);
  });
});
const asset = await assets.put(new Uint8Array(await png.arrayBuffer()), 'image/png');
if (!asset.ok) throw new Error(asset.error);
const overrides: Record<string, Record<string, unknown>> = {
  image: { asset: asset.value, naturalWidth: 64, naturalHeight: 64, name: 'Красный маркер' },
  entity: { entityId: 'entity-fixture', view: 'full' },
  board: { boardId: 'nested-fixture' },
};
const created = executeBoardCommand(
  doc,
  boardId,
  {
    kind: 'createElements',
    elements: elementTypes.map((type, index) => {
      const definition = definitionFor(type);
      return {
        type,
        data: { ...definition.createData(), ...overrides[type] },
        placement: {
          x: (index % 4) * 400 - 200,
          y: Math.floor(index / 4) * 350 - 100,
          width: 320,
          height: Math.min(240, definition.defaultSize.height),
        },
        ...(definition.richText ? { richText: plainToRichText(definition.label()) } : {}),
      };
    }),
  },
  environment,
);
if (!created.ok) throw new Error(created.error);
const elements = createBoardElementsStore(doc);
const column = [...elements.getSnapshot().values()].find(
  (element) => definitionFor(element.type).container,
);
if (column !== undefined)
  executeBoardCommand(
    doc,
    boardId,
    {
      kind: 'createElement',
      type: 'note',
      parentId: column.id,
      placement: { x: 0, y: 0, width: 280, height: 48 },
      data: {},
      richText: plainToRichText('Дочерняя заметка'),
    },
    environment,
  );
executeBoardCommand(
  doc,
  boardId,
  {
    kind: 'createConnection',
    from: { kind: 'point', x: -190, y: 210 },
    to: { kind: 'point', x: 420, y: 210 },
    style: { lineStyle: 'curved', startMarker: 'dot', endMarker: 'arrow' },
  },
  environment,
);
const connections = createBoardConnectionsStore(doc);
const ignore = (): void => undefined;
const runtime: ElementRuntime = {
  textOf: (id) => textOf(doc, id),
  ensureText: () => null,
  stopEditing: ignore,
  undo: ignore,
  redo: ignore,
  assets,
  elements,
  ChildView: () => null,
  updateData: ignore,
  openAsset: null,
  openUrl: ignore,
  refresh: ignore,
  reportHeight: ignore,
  boards: { subscribe: () => ignore, get: () => ({ title: 'Вложенная доска', deleted: false }) },
};
const entity = EntitySchema.parse({
  id: 'entity-fixture',
  typeId: 'type-fixture',
  name: 'Трактирщик Борис',
  values: {},
  tags: {},
  createdAt: 1,
  updatedAt: 1,
  deletedAt: null,
});
const type = EntityTypeSchema.parse({
  id: 'type-fixture',
  name: 'Персонаж',
  builtin: null,
  icon: '🙂',
  color: 'default',
  fields: {},
  createdAt: 1,
  updatedAt: 1,
  deletedAt: null,
});
const entities = new Map([[entity.id, entity]]);
const types = new Map([[type.id, type]]);
const tags = new Map();
const root = document.getElementById('root');
if (root === null) throw new Error('Нет root');
const title = 'Все элементы';
createRoot(root).render(
  <EntityContext.Provider
    value={{
      assets,
      createTag: () => null,
      openEntity: ignore,
      directory: {
        entities: { subscribe: () => ignore, getSnapshot: () => entities },
        types: { subscribe: () => ignore, getSnapshot: () => types },
        textOf: () => null,
      },
      tags: { subscribe: () => ignore, getSnapshot: () => tags },
    }}
  >
    <PngExportDialog
      title={title}
      runtime={runtime}
      save={downloadFile}
      onClose={ignore}
      source={{
        elements: elements.getSnapshot(),
        connections: connections.getSnapshot(),
        selection: new Set(
          [...elements.getSnapshot().values()]
            .filter((item) => item.type === 'image')
            .map((item) => item.id),
        ),
        connectionSelection: new Set(),
      }}
    />
  </EntityContext.Provider>,
);
