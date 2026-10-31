import { describe, expect, it } from 'vitest';
import { ElementIdSchema } from '../model';
import { createManualClock } from './clock';
import { createManualFolderWatcher } from './folderWatcher';
import { createRandomIdGenerator, createSequentialIdGenerator } from './idGenerator';
import { createMemoryFileSystem } from './memoryFileSystem';
import { scopedFileSystem, scopedFolderWatcher } from './scopedFileSystem';

describe('генераторы id', () => {
  it('случайные id корректны по схеме и не повторяются', () => {
    const generator = createRandomIdGenerator();
    const ids = Array.from({ length: 10_000 }, () => generator.next());
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids.slice(0, 100)) expect(ElementIdSchema.safeParse(id).success).toBe(true);
  });

  it('последовательные id предсказуемы и тоже проходят схему', () => {
    const generator = createSequentialIdGenerator('el');
    expect([generator.next(), generator.next()]).toEqual(['el-00000001', 'el-00000002']);
    expect(ElementIdSchema.safeParse(generator.next()).success).toBe(true);
  });
});

describe('ручные часы', () => {
  it('идут только по команде', () => {
    const clock = createManualClock(1000);
    expect(clock.now()).toBe(1000);
    clock.advance(500);
    expect(clock.now()).toBe(1500);
  });
});

describe('слежение за папкой', () => {
  it('сообщает только об изменениях внутри отслеживаемой папки', () => {
    const watcher = createManualFolderWatcher();
    const seen: (readonly string[])[] = [];
    const stop = watcher.watch('data', (paths) => seen.push(paths));
    watcher.emit(['data/phone/board.log', 'assets/a.png']);
    watcher.emit(['assets/b.png']);
    stop();
    watcher.emit(['data/phone/board.log']);
    expect(seen).toEqual([['data/phone/board.log']]);
  });
});

describe('папки внутри файловой системы', () => {
  it('подпапка видит только свои файлы, дата изменения — по самому новому', async () => {
    const clock = createManualClock(100);
    const fs = createMemoryFileSystem(clock);
    const game = scopedFileSystem(fs, 'Игра.doska');
    await game.writeFileAtomic('project.json', new Uint8Array([1]));
    clock.advance(50);
    await fs.writeFileAtomic('Другой.doska/project.json', new Uint8Array([2]));
    expect(await fs.listDir('')).toEqual(['Игра.doska', 'Другой.doska'].sort());
    expect(await game.listDir('')).toEqual(['project.json']);
    expect(await game.latestChange('')).toBe(100);
    expect(await fs.latestChange('')).toBe(150);
    expect(await fs.latestChange('Нет.doska')).toBeNull();
  });
});

describe('слежение внутри подпапки', () => {
  it('видит только свою папку, пути — относительные', () => {
    const watcher = createManualFolderWatcher();
    const seen: string[] = [];
    const stop = scopedFolderWatcher(watcher, 'Игра.doska').watch('data', (paths) => {
      seen.push(...paths);
    });
    watcher.emit(['Игра.doska/data/phone/project.log', 'Сайт.doska/data/phone/project.log']);
    stop();
    watcher.emit(['Игра.doska/data/phone/b.log']);
    expect(seen).toEqual(['data/phone/project.log']);
  });
});
