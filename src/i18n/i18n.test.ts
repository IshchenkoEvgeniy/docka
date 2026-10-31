import { describe, expect, it } from 'vitest';
import { t, type TranslationKey } from './index';

describe('переводы', () => {
  it('находит строку по вложенному ключу', () => {
    expect(t('board.menu.copy')).toBe('Копировать');
  });

  it('пропущенный ключ виден в интерфейсе, а не роняет приложение', () => {
    expect(t('board.nothing' as TranslationKey)).toBe('board.nothing'); // нарочно несуществующий ключ
  });

  it('подстановки и русские множественные формы', () => {
    expect(t('home.projectsCount', { count: 1 })).toBe('1 проект');
    expect(t('home.projectsCount', { count: 3 })).toBe('3 проекта');
    expect(t('home.projectsCount', { count: 5 })).toBe('5 проектов');
    expect(t('home.projectsCount', { count: 21 })).toBe('21 проект');
    expect(t('home.folder', { path: 'C:\\Доска' })).toBe('Папка проектов: C:\\Доска');
  });
});
