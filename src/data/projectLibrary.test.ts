import { describe, expect, it } from 'vitest';
import {
  createManualClock,
  createMemoryFileSystem,
  createSequentialIdGenerator,
  scopedFileSystem,
} from '../core';
import { loadDeviceSettings, saveDeviceSettings, SETTINGS_FILE } from './deviceSettings';
import {
  createProjectIn,
  isProjectPath,
  joinPath,
  listProjects,
  projectFolderName,
  samePath,
} from './projectLibrary';

const encoder = new TextEncoder();

function context(clock = createManualClock(1000)) {
  return { deviceId: 'device-pc-01', clock, ids: createSequentialIdGenerator('p') };
}

describe('папка проектов', () => {
  it('имя папки: без запрещённых символов и не занятое', () => {
    expect(projectFolderName('  Игра: «Сага» / часть 1? ', [])).toBe('Игра «Сага» часть 1.doska');
    expect(projectFolderName('Игра', ['игра.doska', 'Игра 2.doska'])).toBe('Игра 3.doska');
    expect(projectFolderName('...', [])).toBe('Проект.doska');
  });

  it('создаёт проекты и перечисляет их, свежие сверху; чужие папки пропускает', async () => {
    const clock = createManualClock(1000);
    const fs = createMemoryFileSystem(clock);
    const first = await createProjectIn(fs, context(clock), 'Игра');
    clock.advance(500);
    const second = await createProjectIn(fs, context(clock), 'Сайт');
    if (!first.ok || !second.ok) throw new Error('не создан');
    await first.value.project.close();
    await second.value.project.close();
    await fs.writeFileAtomic('Заметки/readme.txt', encoder.encode('не проект'));
    await fs.writeFileAtomic('Пусто.doska/x.txt', encoder.encode('нет project.json'));

    const list = await listProjects(fs);
    expect(list.map((entry) => entry.folder)).toEqual(['Сайт.doska', 'Игра.doska']);
    expect(list[0]).toMatchObject({ status: 'ok', meta: { name: 'Сайт' }, modifiedAt: 1500 });
  });

  it('повреждённый и более новый проект видны, но с причиной', async () => {
    const fs = createMemoryFileSystem();
    await fs.writeFileAtomic('Битый.doska/project.json', encoder.encode('{oops'));
    await scopedFileSystem(fs, 'Новый.doska').writeFileAtomic(
      'project.json',
      encoder.encode(JSON.stringify({ formatVersion: 99 })),
    );
    const list = await listProjects(fs);
    expect(list.map((entry) => entry.status).sort()).toEqual(['broken', 'newer']);
  });

  it('пустое название не создаёт проект', async () => {
    const result = await createProjectIn(createMemoryFileSystem(), context(), '   ');
    expect(result.ok).toBe(false);
  });
});

describe('настройки устройства', () => {
  const defaults = { deviceName: 'Компьютер', language: 'ru' };

  it('первый запуск создаёт постоянный id устройства и сохраняет его', async () => {
    const fs = createMemoryFileSystem();
    const ids = createSequentialIdGenerator('dev');
    const first = await loadDeviceSettings(fs, defaults, ids);
    const again = await loadDeviceSettings(fs, defaults, ids);
    expect(again.deviceId).toBe(first.deviceId);
    expect(first).toMatchObject({ deviceName: 'Компьютер', theme: 'system', projectsFolder: null });
  });

  it('битые поля заменяются, id устройства сохраняется', async () => {
    const fs = createMemoryFileSystem();
    const ids = createSequentialIdGenerator('dev');
    const settings = await loadDeviceSettings(fs, defaults, ids);
    await saveDeviceSettings(fs, settings);
    const broken = {
      ...settings,
      theme: 'neon',
      favorites: [{ boardId: 1 }],
      deviceName: '',
      zoomedOutView: 'blur',
    };
    await fs.writeFileAtomic(SETTINGS_FILE, encoder.encode(JSON.stringify(broken)));
    const repaired = await loadDeviceSettings(fs, defaults, ids);
    expect(repaired).toMatchObject({
      deviceId: settings.deviceId,
      theme: 'system',
      favorites: [],
      deviceName: 'Компьютер',
      zoomedOutView: 'auto',
    });
  });
});

describe('проекты вне папки проектов', () => {
  it('полный путь отличается от имени подпапки', () => {
    expect(isProjectPath('Игра.doska')).toBe(false);
    expect(isProjectPath('C:\\Игры\\Игра.doska')).toBe(true);
    expect(isProjectPath('/storage/emulated/0/Doska/Игра.doska')).toBe(true);
  });

  it('путь собирается разделителем родительской папки', () => {
    expect(joinPath('C:\\Игры', 'Мир.doska')).toBe('C:\\Игры\\Мир.doska');
    expect(joinPath('D:\\', 'Мир.doska')).toBe('D:\\Мир.doska');
    expect(joinPath('/sdcard/Doska/', 'Мир.doska')).toBe('/sdcard/Doska/Мир.doska');
  });

  it('пути Windows сравниваются без учёта регистра', () => {
    expect(samePath('C:\\Игры\\', 'c:\\игры')).toBe(true);
    expect(samePath('/a/B', '/a/b')).toBe(false);
  });
});
