import { describe, expect, it } from 'vitest';
import type { BoardElement } from '../../core';
import { definitionFor } from '../registry';
import { EntityElementDataSchema } from './schema';

const placed = (data: Record<string, unknown>) =>
  ({ type: 'entity', data, color: 'default' }) as unknown as BoardElement; // нужны только эти поля

describe('элемент «Сущность»', () => {
  const definition = definitionFor('entity');

  it('хранит только ссылку и вид; битые данные отклоняются', () => {
    expect(
      EntityElementDataSchema.safeParse({ entityId: 'npc-borisx', view: 'chip' }).success,
    ).toBe(true);
    expect(EntityElementDataSchema.safeParse({ entityId: 'npc-borisx', view: 'big' }).success).toBe(
      false,
    );
    expect(EntityElementDataSchema.safeParse({ entityId: '../x', view: 'card' }).success).toBe(
      false,
    );
  });

  it('открывает сущность, отдаёт ссылку и меняет её для независимой копии', () => {
    const element = placed({ entityId: 'npc-borisx', view: 'card' });
    expect(definition.activate).toBe('open');
    expect(definition.target(element)).toEqual({ kind: 'entity', id: 'npc-borisx' });
    expect(definition.entityOf(element.data)).toBe('npc-borisx');
    expect(definition.withEntity(element.data, 'npc-copy01')).toEqual({
      entityId: 'npc-copy01',
      view: 'card',
    });
    expect(definitionFor('note').entityOf({})).toBeNull();
  });

  it('вид переключается пунктами меню; выбранный отмечен', () => {
    const actions = definition.menuActions(placed({ entityId: 'npc-borisx', view: 'chip' }));
    expect(actions.map((action) => [action.changes, action.checked])).toEqual([
      [{ view: 'chip' }, true],
      [{ view: 'card' }, false],
      [{ view: 'full' }, false],
    ]);
  });

  it('у доски цель — доска', () => {
    expect(definitionFor('board').target(placed({ boardId: 'board-0001' }))).toEqual({
      kind: 'board',
      id: 'board-0001',
    });
  });
});
