import { describe, expect, it } from 'vitest';
import {
  createManualClock,
  createMemoryFileSystem,
  createSequentialIdGenerator,
  fieldsOf,
} from '../../core';
import {
  createProject,
  executeProjectCommand,
  listTemplates,
  readBoards,
  readConnections,
  readElements,
  readEntityTypes,
  saveTemplate,
} from '../../data';
import { applyTemplate } from './apply';
import { builtinTemplates } from './builtin';
import { captureTemplate } from './capture';

async function newProject() {
  const fs = createMemoryFileSystem();
  const environment = { clock: createManualClock(1), ids: createSequentialIdGenerator('t') };
  const created = await createProject({ fs, deviceId: 'pc', ...environment }, 'Моя игра');
  if (!created.ok) throw new Error(created.error);
  return { fs, environment, project: created.value };
}

const game = () => {
  const template = builtinTemplates().projects.find((item) => item.name === 'Игра');
  if (template === undefined) throw new Error('нет шаблона');
  return template;
};

describe('шаблоны', () => {
  it('проект «Игра» создаётся из шаблона (приёмка этапа 6)', async () => {
    const { environment, project } = await newProject();
    const root = project.meta.rootBoardId;
    const applied = await applyTemplate(project, environment, game(), { boardId: root });
    expect(applied).toEqual({ ok: true, value: root });
    const boards = readBoards(project.projectDoc.doc).items;
    const children = boards.filter((board) => board.parentId === root).map((board) => board.title);
    expect(children.sort()).toEqual(
      ['ГДД', 'Задачи', 'Квесты', 'Локации', 'НПС', 'Предметы'].sort(),
    );
    const cards = readElements((await project.openBoard(root)).doc).items.filter(
      (item) => item.type === 'board',
    );
    expect(new Set(cards.map((card) => card.data.boardId)).size).toBe(6);
    const quest = readEntityTypes(project.projectDoc.doc).items.find(
      (type) => type.name === 'Квест',
    );
    expect(quest === undefined ? [] : fieldsOf(quest).map((field) => field.name)).toEqual([
      'Описание',
      'Статус',
      'Награда',
      'Выдаёт',
      'Где',
    ]);
    const quests = boards.find((board) => board.title === 'Квесты');
    const story = await project.openBoard(quests?.id ?? root);
    expect(readConnections(story.doc).items).toHaveLength(6);
  });

  it('доска → шаблон → файл → новая доска: элементы, стрелки, теги, вложенные доски', async () => {
    const { fs, environment, project } = await newProject();
    const root = project.meta.rootBoardId;
    await applyTemplate(project, environment, game(), { boardId: root });
    executeProjectCommand(
      project.projectDoc.doc,
      { kind: 'createTag', name: 'мир/таверны', color: 'red' },
      environment,
    );
    const template = await captureTemplate(project, root, {
      id: 'my-template-1',
      name: 'Копия игры',
      description: '',
    });
    if (template === null) throw new Error('нет шаблона');
    expect((await saveTemplate(fs, template)).ok).toBe(true);
    expect((await saveTemplate(fs, template)).ok).toBe(false);
    const listed = await listTemplates(fs, project.projectDoc.doc);
    expect(listed.templates.map((item) => item.name)).toEqual(['Копия игры']);
    const copy = await applyTemplate(project, environment, listed.templates[0] ?? template, {
      parentId: root,
    });
    if (!copy.ok) throw new Error(copy.error);
    const nested = readBoards(project.projectDoc.doc).items.filter(
      (board) => board.parentId === copy.value,
    );
    expect(nested).toHaveLength(6);
    executeProjectCommand(
      project.projectDoc.doc,
      { kind: 'removeTemplate', templateId: 'my-template-1' },
      environment,
    );
    expect((await listTemplates(fs, project.projectDoc.doc)).templates).toEqual([]);
    const types = readEntityTypes(project.projectDoc.doc).items.filter(
      (type) => type.name === 'Квест',
    );
    expect(types).toHaveLength(1);
  });
});
