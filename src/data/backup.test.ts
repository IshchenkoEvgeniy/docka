import { describe, expect, it } from 'vitest';
import {
  createManualClock,
  createMemoryFileSystem,
  createSequentialIdGenerator,
  type BoardId,
  type MemoryFileSystem,
} from '../core';
import {
  backupFileName,
  ensureDailyBackup,
  parseBackup,
  pruneBackups,
  restoreBackup,
  writeBackup,
} from './backup';
import { executeBoardCommand, executeProjectCommand } from './commands';
import { createProject, openProject, type ProjectContext } from './project';
import { readBoards, readElements } from './projectDocument';

const DAY = 24 * 60 * 60 * 1000;

async function projectWithContent(fs: MemoryFileSystem) {
  const clock = createManualClock(Date.UTC(2026, 9, 31, 12));
  const context: ProjectContext = {
    fs,
    deviceId: 'pc',
    clock,
    ids: createSequentialIdGenerator('id'),
  };
  const created = await createProject(context, 'Игра');
  if (!created.ok) throw new Error(created.error);
  const project = created.value;
  const board = executeProjectCommand(
    project.projectDoc.doc,
    { kind: 'createBoard', parentId: project.meta.rootBoardId, title: 'НПС' },
    context,
  );
  const boardId = (board.ok ? board.value.createdId : undefined) as BoardId; // создана выше
  const stored = await project.openBoard(boardId);
  executeBoardCommand(
    stored.doc,
    boardId,
    {
      kind: 'createElement',
      type: 'note',
      placement: { x: 1, y: 2, width: 3, height: 4 },
      data: { text: 'Трактирщик' },
    },
    context,
  );
  await project.closeBoard(boardId);
  return { project, boardId, clock };
}

describe('резервные копии', () => {
  it('копия содержит все доски, даже закрытые, и восстанавливается в пустую папку', async () => {
    const { project, boardId, clock } = await projectWithContent(createMemoryFileSystem());
    const backups = createMemoryFileSystem();
    const path = await writeBackup(project, backups, clock.now());
    expect(path).toBe(`${project.meta.id}/2026-10-31.doskabackup`);
    expect(project.openBoardIds()).toEqual([]);

    const data = backups.snapshot().get(path);
    if (data === undefined) throw new Error('нет копии');
    const target = createMemoryFileSystem();
    const restored = await restoreBackup(data, target, 'laptop');
    expect(restored.ok).toBe(true);

    const reopened = await openProject({
      fs: target,
      deviceId: 'laptop',
      clock,
      ids: createSequentialIdGenerator('x'),
    });
    if (!reopened.ok) throw new Error(reopened.error);
    expect(
      readBoards(reopened.value.projectDoc.doc)
        .items.map((board) => board.title)
        .sort(),
    ).toEqual(['Игра', 'НПС']);
    const board = await reopened.value.openBoard(boardId);
    expect(readElements(board.doc).items[0]?.data).toEqual({ text: 'Трактирщик' });
  });

  it('не восстанавливает поверх существующего проекта', async () => {
    const fs = createMemoryFileSystem();
    const { project, clock } = await projectWithContent(fs);
    const backups = createMemoryFileSystem();
    const path = await writeBackup(project, backups, clock.now());
    const data = backups.snapshot().get(path) ?? new Uint8Array();
    expect(await restoreBackup(data, fs, 'pc')).toEqual({
      ok: false,
      error: 'Восстанавливать можно только в пустую папку',
    });
  });

  it('одна копия в день, хранятся последние 14', async () => {
    const { project, clock } = await projectWithContent(createMemoryFileSystem());
    const backups = createMemoryFileSystem();
    expect(await ensureDailyBackup(project, backups, clock.now())).toBe(true);
    expect(await ensureDailyBackup(project, backups, clock.now() + 1000)).toBe(false);
    for (let day = 1; day <= 20; day += 1)
      await ensureDailyBackup(project, backups, clock.now() + day * DAY);
    const names = await backups.listDir(project.meta.id);
    expect(names).toHaveLength(14);
    expect(names.at(-1)).toBe(backupFileName(clock.now() + 20 * DAY));
    expect(await pruneBackups(backups, project.meta.id)).toEqual([]);
  });

  it('мусор вместо копии — понятная ошибка', () => {
    expect(parseBackup(new Uint8Array([1, 2, 3])).ok).toBe(false);
    expect(parseBackup(new Uint8Array()).ok).toBe(false);
  });
});
