import { describe, expect, it } from 'vitest';
import { createProjectHealth } from './projectHealth';

describe('состояние сохранения проекта', () => {
  it('не скрывает ошибку одной доски после сохранения другой', () => {
    const health = createProjectHealth();
    health.saved('a', 'error');
    health.saved('b', 'saved');
    expect(health.store.getState().saving).toBe('error');
    health.saved('a', 'saving');
    expect(health.store.getState().saving).toBe('saving');
    health.saved('a', 'saved');
    expect(health.store.getState().saving).toBe('saved');
  });

  it('показывает несохранённые изменения и сохраняет предупреждение о резервной копии', () => {
    const health = createProjectHealth();
    health.warn('backup');
    health.saved('a', 'pending');
    health.saved('b', 'saved');
    expect(health.store.getState()).toEqual({ saving: 'pending', warning: 'backup' });
    health.dismiss();
    expect(health.store.getState().warning).toBeNull();
  });
});
