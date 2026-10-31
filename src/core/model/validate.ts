import type { z } from 'zod';
import { err, ok, type Result } from '../result';

/**
 * Проверка данных, пришедших извне (файлы, буфер обмена, импорт).
 * Ошибка — короткое описание первого несоответствия: путь к полю и причина.
 */
export function validate<S extends z.ZodType>(schema: S, value: unknown): Result<z.infer<S>> {
  const result = schema.safeParse(value);
  if (result.success) return ok(result.data);
  const issue = result.error.issues[0];
  if (issue === undefined) return err('Неизвестная ошибка проверки');
  const path = issue.path.map(String).join('.');
  return err(path === '' ? issue.message : `${path}: ${issue.message}`);
}
