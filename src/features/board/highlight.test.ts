import { describe, expect, it } from 'vitest';
import * as Y from 'yjs';
import {
  createManualClock,
  createSequentialIdGenerator,
  plainToRichText,
  type BoardId,
  type RichNode,
  type Tag,
  type TagId,
} from '../../core';
import { computeHighlight } from './highlight';
import { createBoardModel } from './model';

const tag = (id: string, name: string): Tag => ({ id: id as TagId, name, color: 'red' }); // id корректный

describe('подсветка на доске', () => {
  const environment = { clock: createManualClock(1), ids: createSequentialIdGenerator('el') };
  const model = createBoardModel(new Y.Doc(), 'board-0001' as BoardId, environment); // корректный id
  const hashtag: RichNode[] = [
    {
      type: 'element',
      name: 'paragraph',
      children: [
        {
          type: 'element',
          name: 'mention',
          attrs: { id: 'tag-world-1', mentionSuggestionChar: '#' },
          children: [],
        },
      ],
    },
  ];
  const note = (text: RichNode[], tagIds: TagId[] = []) => ({
    type: 'note',
    placement: { x: 0, y: 0, width: 100, height: 40 },
    data: {},
    richText: text,
    tagIds,
  });
  const result = model.run({
    kind: 'createElements',
    elements: [
      note(plainToRichText('Таверна у моста'), ['tag-city-01' as TagId]),
      note(hashtag),
      note(plainToRichText('Пещера')),
    ],
  });
  const [tavern, tagged, cave] = result?.createdIds ?? [];
  const tags = new Map([
    ['tag-world-1', tag('tag-world-1', 'мир')],
    ['tag-city-01', tag('tag-city-01', 'мир/город')],
  ]);

  it('без фильтра подсветки нет', () => {
    expect(computeHighlight(model, tags)).toBeNull();
  });

  it('тег находит вложенные и поставленные в тексте через #', () => {
    model.settings.setState({ tagFilter: 'мир', find: null });
    expect(computeHighlight(model, tags)).toEqual(new Set([tavern, tagged]));
    expect(computeHighlight(model, tags)?.has(cave ?? '')).toBe(false);
  });

  it('поиск по тексту без учёта регистра и ё; вместе с тегом — пересечение', () => {
    model.settings.setState({ tagFilter: null, find: 'ПЕЩ' });
    expect(computeHighlight(model, tags)).toEqual(new Set([cave]));
    model.settings.setState({ tagFilter: 'мир', find: 'моста' });
    expect(computeHighlight(model, tags)).toEqual(new Set([tavern]));
  });
});
