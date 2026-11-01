import { describe, expect, it } from 'vitest';
import {
  createManualClock,
  createMemoryFileSystem,
  createSequentialIdGenerator,
  scopedFileSystem,
} from '../core';
import { createProjectIn, listProjects } from './projectLibrary';
import { deleteProjectIn } from './deleteProject';

async function setup() {
  const fs = createMemoryFileSystem();
  const context = {
    deviceId: 'test-device',
    clock: createManualClock(1),
    ids: createSequentialIdGenerator('project'),
  };
  const first = await createProjectIn(fs, context, 'Игра');
  const second = await createProjectIn(fs, context, 'Сосед');
  if (!first.ok || !second.ok) throw new Error('Не создано');
  await first.value.project.close();
  await second.value.project.close();
  await fs.writeFileAtomic(`${first.value.folder}/assets/test.png`, new Uint8Array([1, 2]));
  await fs.writeFileAtomic('backups/test.backup', new Uint8Array([9]));
  return { fs, first: first.value, second: second.value };
}

describe('удаление проекта', () => {
  it('удаляет все файлы выбранного проекта и сохраняет соседей и резервные копии', async () => {
    const { fs, first, second } = await setup();
    expect((await deleteProjectIn(fs, first.folder, first.project.meta.id)).ok).toBe(true);
    expect([...fs.snapshot().keys()].some((path) => path.startsWith(`${first.folder}/`))).toBe(
      false,
    );
    expect((await listProjects(fs)).map((item) => item.folder)).toEqual([second.folder]);
    expect(await fs.readFile('backups/test.backup')).toEqual(new Uint8Array([9]));
  });

  it('проверяет актуальный id и не удаляет заменённый проект', async () => {
    const { fs, first, second } = await setup();
    const before = fs.snapshot();
    expect((await deleteProjectIn(fs, first.folder, second.project.meta.id)).ok).toBe(false);
    expect(fs.snapshot()).toEqual(before);
  });

  it('отклоняет корень, выход наружу и папку без метаданных', async () => {
    const { fs, first } = await setup();
    const before = fs.snapshot();
    for (const folder of [
      '',
      '.',
      '..',
      '../Игра.doska',
      '/Игра.doska',
      'C:\\Игра.doska',
      'backups',
    ])
      expect((await deleteProjectIn(fs, folder, first.project.meta.id)).ok).toBe(false);
    expect(fs.snapshot()).toEqual(before);
    await expect(fs.removeDirectory('')).rejects.toThrow('INVALID_PATH');
    await expect(scopedFileSystem(fs, first.folder).removeDirectory('')).rejects.toThrow(
      'INVALID_PATH',
    );
  });

  it('передаёт ошибку диска, не сообщает об успешном удалении', async () => {
    const { fs, first } = await setup();
    await expect(
      deleteProjectIn(
        { ...fs, removeDirectory: () => Promise.reject(new Error('disk denied')) },
        first.folder,
        first.project.meta.id,
      ),
    ).rejects.toThrow('disk denied');
    expect(await fs.readFile(`${first.folder}/project.json`)).not.toBeNull();
  });
});
