import { describe, expect, it } from 'vitest';
import { createMemoryFileSystem, type FileSystem } from '../core';
import { openDocument } from './documentStore';

describe('восстановление сохранения после ошибок диска', () => {
  it('повторяет запись после частично записанного кадра и сохраняет последующие правки', async () => {
    const disk = createMemoryFileSystem();
    let failed = false;
    const fs: FileSystem = {
      ...disk,
      appendFile: async (path, data) => {
        if (!failed) {
          failed = true;
          await disk.appendFile(path, data.subarray(0, 10));
          throw new Error('Диск недоступен');
        }
        await disk.appendFile(path, data);
      },
    };
    const stored = await openDocument({ fs, deviceId: 'pc' }, 'board');
    stored.doc.getMap('test').set('first', 'до сбоя');
    await expect(stored.flush()).rejects.toThrow('Диск недоступен');
    stored.doc.getMap('test').set('second', 'после сбоя');
    await stored.flush();
    stored.close();
    const reopened = await openDocument({ fs: disk, deviceId: 'pc' }, 'board');
    expect(reopened.doc.getMap('test').toJSON()).toEqual({
      first: 'до сбоя',
      second: 'после сбоя',
    });
    reopened.close();
  });

  it('не теряет правки, сделанные во время записи снимка с последующим сбоем очистки журнала', async () => {
    const disk = createMemoryFileSystem();
    let fail = true;
    const fs: FileSystem = {
      ...disk,
      writeFileAtomic: async (path, data) => {
        if (path.endsWith('.log') && fail) {
          fail = false;
          throw new Error('Ошибка очистки');
        }
        await disk.writeFileAtomic(path, data);
      },
    };
    const stored = await openDocument({ fs, deviceId: 'pc' }, 'board');
    stored.doc.getMap('test').set('first', 1);
    await expect(stored.compact()).rejects.toThrow('Ошибка очистки');
    stored.doc.getMap('test').set('second', 2);
    await stored.flush();
    stored.close();
    const reopened = await openDocument({ fs: disk, deviceId: 'pc' }, 'board');
    expect(reopened.doc.getMap('test').toJSON()).toEqual({ first: 1, second: 2 });
    reopened.close();
  });

  it('не удаляет из очереди изменения, пришедшие во время записи', async () => {
    const disk = createMemoryFileSystem();
    let duringWrite = (): void => undefined;
    const fs: FileSystem = {
      ...disk,
      appendFile: async (path, data) => {
        duringWrite();
        await disk.appendFile(path, data);
      },
    };
    const stored = await openDocument({ fs, deviceId: 'pc' }, 'board');
    stored.doc.getMap('test').set('first', 1);
    duringWrite = () => {
      stored.doc.getMap('test').set('second', 2);
      duringWrite = () => undefined;
    };
    await stored.flush();
    await stored.flush();
    stored.close();
    const reopened = await openDocument({ fs: disk, deviceId: 'pc' }, 'board');
    expect(reopened.doc.getMap('test').toJSON()).toEqual({ first: 1, second: 2 });
    reopened.close();
  });
});
