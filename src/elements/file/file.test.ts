import { describe, expect, it } from 'vitest';
import { extensionOf, fileIcon, isPdf } from './kind';

describe('карточка файла', () => {
  it('значок по расширению', () => {
    expect(extensionOf('Отчёт.Final.DOCX')).toBe('docx');
    expect(extensionOf('.gitignore')).toBe('');
    expect(fileIcon('план.xlsx')).toBe('📊');
    expect(isPdf('application/octet-stream', 'gdd.pdf')).toBe(true);
  });
});
