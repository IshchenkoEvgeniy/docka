import { describe, expect, it } from 'vitest';
import * as Y from 'yjs';
import {
  createManualClock,
  createSequentialIdGenerator,
  hasTag,
  resolveTag,
  type ProjectCommand,
  type TagId,
} from '../../core';
import { readTags } from '../projectDocument';
import { executeProjectCommand } from './projectCommands';
import { createUndoHistory } from './undo';

function setup() {
  const doc = new Y.Doc();
  const environment = { clock: createManualClock(1), ids: createSequentialIdGenerator('tag') };
  const run = (command: ProjectCommand) => executeProjectCommand(doc, command, environment);
  const tag = (name: string) => {
    const result = run({ kind: 'createTag', name, color: 'red' });
    if (!result.ok || result.value.createdId === undefined) throw new Error('нет тега');
    return result.value.createdId as TagId; // создан выше
  };
  const byId = () => new Map(readTags(doc).items.map((item) => [item.id as string, item]));
  return { doc, run, tag, byId };
}

describe('теги', () => {
  it('переименование родителя переименовывает вложенные — одним шагом отмены', () => {
    const { doc, run, tag, byId } = setup();
    const bug = tag('баг');
    const critical = tag('баг/критичный');
    tag('багет');
    const history = createUndoHistory(doc, ['tags']);
    expect(run({ kind: 'updateTag', tagId: bug, changes: { name: 'ошибка' } }).ok).toBe(true);
    expect([...byId().values()].map((item) => item.name).sort()).toEqual([
      'багет',
      'ошибка',
      'ошибка/критичный',
    ]);
    history.undo();
    expect(byId().get(critical)?.name).toBe('баг/критичный');
  });

  it('фильтр по родителю находит вложенные; слитый тег читается как целевой', () => {
    const { run, tag, byId } = setup();
    const world = tag('мир');
    const city = tag('мир/город');
    const town = tag('городок');
    const filter = byId().get(world)?.name ?? '';
    expect(hasTag([city], filter, byId())).toBe(true);
    expect(hasTag([city], 'ми', byId())).toBe(false);
    expect(hasTag([town], filter, byId())).toBe(false);
    expect(run({ kind: 'mergeTags', tagId: town, intoId: city }).ok).toBe(true);
    expect(resolveTag(town, byId())?.name).toBe('мир/город');
    expect(hasTag([town], filter, byId())).toBe(true);
    expect(run({ kind: 'mergeTags', tagId: city, intoId: city }).ok).toBe(false);
  });

  it('удалённый тег не находится, ссылки на него безвредны', () => {
    const { run, tag, byId } = setup();
    const quest = tag('квест');
    const filter = 'квест';
    run({ kind: 'deleteTag', tagId: quest });
    expect(resolveTag(quest, byId())).toBeNull();
    expect(hasTag([quest], filter, byId())).toBe(false);
  });
});
