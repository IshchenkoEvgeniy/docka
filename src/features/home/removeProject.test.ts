import { describe, expect, it } from 'vitest';
import { projectParent } from './removeProject';

describe('родитель внешнего проекта', () => {
  it('сохраняет абсолютные корни Windows, UNC и Android', () => {
    expect(projectParent('C:\\Игра.doska')).toEqual({ parent: 'C:\\', folder: 'Игра.doska' });
    expect(projectParent('C:/Games/Игра.doska/')).toEqual({
      parent: 'C:/Games',
      folder: 'Игра.doska',
    });
    expect(projectParent('\\\\server\\share\\Игра.doska')).toEqual({
      parent: '\\\\server\\share',
      folder: 'Игра.doska',
    });
    expect(projectParent('/storage/emulated/0/Игра.doska')).toEqual({
      parent: '/storage/emulated/0',
      folder: 'Игра.doska',
    });
    expect(projectParent('/Игра.doska')).toEqual({ parent: '/', folder: 'Игра.doska' });
  });
});
