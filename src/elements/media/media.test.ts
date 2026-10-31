import { describe, expect, it } from 'vitest';
import type { BoardElement } from '../../core';
import { definitionFor, definitionForFile } from '../registry';

const stored = { asset: `${'a'.repeat(64)}.mp4`, name: 'Интро.mp4', mime: 'video/mp4', size: 10 };

describe('файлы на доске', () => {
  it('видео и звук — плеером, остальное — карточкой файла', () => {
    expect(definitionForFile('video/mp4')?.type).toBe('video');
    expect(definitionForFile('audio/mpeg')?.type).toBe('audio');
    expect(definitionForFile('application/pdf')?.type).toBe('file');
    expect(definitionForFile('application/x-unknown')?.type).toBe('file');
    expect(definitionForFile('image/png')?.type).toBe('file');
  });

  it('данные плеера и карточки файла проходят схему своего типа', () => {
    const video = definitionFor('video').fromFile?.create(stored);
    const card = definitionFor('file').fromFile?.create({
      ...stored,
      name: 'ГДД.pdf',
      mime: 'application/pdf',
    });
    const element = (type: string, data: unknown) => ({ type, data }) as unknown as BoardElement; // нужны только эти поля
    expect(definitionFor('video').toPlainText(element('video', video?.data), null)).toBe(
      'Интро.mp4',
    );
    expect(definitionFor('file').toPlainText(element('file', card?.data), null)).toBe('ГДД.pdf');
    expect(definitionFor('file').activate).toBe('view');
    expect(definitionFor('file').Viewer).not.toBeNull();
  });
});
