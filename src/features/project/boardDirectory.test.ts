import { describe, expect, it } from 'vitest';
import * as Y from 'yjs';
import { BoardSchema, createManualClock, createSequentialIdGenerator } from '../../core';
import { executeProjectCommand, insertBoard } from '../../data';
import { createBoardDirectory } from './boardDirectory';

describe('справочник названий досок', () => {
  it('возобновляет подписку после cleanup StrictMode', () => {
    const doc = new Y.Doc();
    const board = BoardSchema.parse({
      id: 'board-test',
      title: 'НПС',
      parentId: null,
      icon: null,
      color: 'default',
      background: 'dots',
      tags: {},
      createdAt: 1,
      updatedAt: 1,
      deletedAt: null,
    });
    insertBoard(doc, board);
    const directory = createBoardDirectory(doc);
    const unsubscribe = directory.subscribe(() => undefined);
    unsubscribe();
    directory.destroy();
    let notified = false;
    const stop = directory.subscribe(() => {
      notified = true;
    });
    executeProjectCommand(
      doc,
      { kind: 'updateBoard', boardId: board.id, changes: { title: 'Персонажи' } },
      { clock: createManualClock(2), ids: createSequentialIdGenerator() },
    );
    expect(directory.get(board.id)?.title).toBe('Персонажи');
    expect(notified).toBe(true);
    stop();
    directory.destroy();
  });
});
