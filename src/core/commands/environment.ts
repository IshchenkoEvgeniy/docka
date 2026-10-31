import type { Clock, IdGenerator } from '../ports';

/** Время и генератор id для команд (в тестах — предсказуемые). */
export interface CommandEnvironment {
  readonly clock: Clock;
  readonly ids: IdGenerator;
}
