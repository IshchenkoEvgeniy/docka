import { describe, expect, it } from 'vitest';
import {
  BUILTIN_TYPE_IDS,
  createManualClock,
  createMemoryFileSystem,
  createSequentialIdGenerator,
  type EntityId,
  type MemoryFileSystem,
} from '../core';
import { executeProjectCommand } from './commands';
import { createProject, openProject, type ProjectContext } from './project';
import { readEntities } from './projectDocument';

const context = (fs: MemoryFileSystem, deviceId: string): ProjectContext => ({
  fs,
  deviceId,
  clock: createManualClock(100),
  ids: createSequentialIdGenerator(deviceId),
});

/** Syncthing: копирует папку устройства from на другой «диск». */
function sync(from: MemoryFileSystem, to: MemoryFileSystem, device: string): void {
  for (const [path, data] of from.snapshot())
    if (path.startsWith(`data/${device}/`) || path === 'project.json') to.putExternal(path, data);
}

describe('сущности на двух устройствах', () => {
  it('правка НПС на компьютере видна на телефоне, правки обоих сливаются', async () => {
    const pcFs = createMemoryFileSystem();
    const created = await createProject(context(pcFs, 'pc'), 'Игра');
    if (!created.ok) throw new Error(created.error);
    const pc = created.value;
    const npc = executeProjectCommand(
      pc.projectDoc.doc,
      { kind: 'createEntity', typeId: BUILTIN_TYPE_IDS.npc, name: 'Борис' },
      context(pcFs, 'pc'),
    );
    if (!npc.ok || npc.value.createdId === undefined) throw new Error('нет НПС');
    const id = npc.value.createdId as EntityId; // создан выше
    await pc.flushAll();

    const phoneFs = createMemoryFileSystem();
    sync(pcFs, phoneFs, 'pc');
    const opened = await openProject(context(phoneFs, 'phone'));
    if (!opened.ok) throw new Error(opened.error);
    const phone = opened.value;

    executeProjectCommand(
      pc.projectDoc.doc,
      { kind: 'updateEntity', entityId: id, changes: { name: 'Борис Кузнецов' } },
      context(pcFs, 'pc'),
    );
    executeProjectCommand(
      phone.projectDoc.doc,
      { kind: 'updateEntity', entityId: id, changes: { values: { 'npc-role': 'Трактирщик' } } },
      context(phoneFs, 'phone'),
    );
    await pc.flushAll();
    await phone.flushAll();
    sync(pcFs, phoneFs, 'pc');
    sync(phoneFs, pcFs, 'phone');
    await pc.refreshAll();
    await phone.refreshAll();
    for (const project of [pc, phone])
      expect(readEntities(project.projectDoc.doc).items[0]).toMatchObject({
        name: 'Борис Кузнецов',
        values: { 'npc-role': 'Трактирщик' },
      });
  });
});
