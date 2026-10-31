import type { Timestamp } from '../model';

/** Источник текущего времени. В тестах — управляемые часы, чтобы результат не зависел от момента запуска. */
export interface Clock {
  readonly now: () => Timestamp;
}

export const systemClock: Clock = {
  now: () => Date.now(),
};

export interface ManualClock extends Clock {
  readonly advance: (milliseconds: number) => void;
}

export function createManualClock(start = 0): ManualClock {
  let current = start;
  return {
    now: () => current,
    advance: (milliseconds) => {
      current += milliseconds;
    },
  };
}
