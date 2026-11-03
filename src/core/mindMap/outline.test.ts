import { describe, expect, it } from 'vitest';
import { formatOutline, parseOutline } from './outline';

describe('список ↔ карта', () => {
  it('вложенный список с маркерами — пункты по отступам', () => {
    const items = parseOutline('- Квест\n  - Таверна\n    * Трактирщик\n  - Кузница\n- Финал');
    expect(items).toEqual([
      {
        text: 'Квест',
        children: [
          { text: 'Таверна', children: [{ text: 'Трактирщик', children: [] }] },
          { text: 'Кузница', children: [] },
        ],
      },
      { text: 'Финал', children: [] },
    ]);
  });

  it('нумерация и табуляция тоже считаются', () => {
    expect(parseOutline('1. Акт\n\t1) Сцена\n\t2) Сцена 2')?.[0]?.children).toHaveLength(2);
  });

  it('обычный текст, одноуровневый список и строки без маркера — не карта', () => {
    expect(parseOutline('Просто заметка\n  с отступом')).toBeNull();
    expect(parseOutline('- раз\n- два')).toBeNull();
    expect(parseOutline('- раз\n  два')).toBeNull();
    expect(parseOutline('')).toBeNull();
  });

  it('«вставить как карту»: любые строки — пункты', () => {
    expect(parseOutline('раз\nдва', true)).toEqual([
      { text: 'раз', children: [] },
      { text: 'два', children: [] },
    ]);
  });

  it('вывод — вложенный список Markdown, обратно разбирается так же', () => {
    const items = parseOutline('- Квест\n  - Таверна\n  - Кузница');
    if (items === null) throw new Error('нет пунктов');
    const text = formatOutline(items).join('\n');
    expect(text).toBe('- Квест\n  - Таверна\n  - Кузница');
    expect(parseOutline(text)).toEqual(items);
  });
});
