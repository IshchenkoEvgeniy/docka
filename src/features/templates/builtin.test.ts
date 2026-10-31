import { describe, expect, it } from 'vitest';
import { builtinTemplates } from './builtin';

describe('встроенные шаблоны', () => {
  it('10 шаблонов досок из ТЗ и проекты «Игра» и «Сайт» проходят схему', () => {
    const { boards, projects } = builtinTemplates();
    expect(boards.map((template) => template.name)).toEqual([
      'ТЗ программы',
      'Архитектура и схема БД',
      'Карта экранов сайта',
      'Гейм-дизайн документ',
      'Персонажи и НПС',
      'Локации и мир',
      'Сюжет и квесты',
      'Мудборд',
      'Канбан задач',
      'Роадмап',
    ]);
    expect(projects.map((template) => template.name)).toEqual(['Игра', 'Сайт']);
    const game = projects[0];
    expect(game?.board.children?.map((board) => board.title)).toEqual([
      'НПС',
      'Локации',
      'Предметы',
      'Квесты',
      'ГДД',
      'Задачи',
    ]);
    expect(game?.board.children?.[5]?.elements.length).toBeGreaterThan(4);
  });
});
