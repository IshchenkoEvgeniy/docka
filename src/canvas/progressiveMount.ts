/**
 * Постепенный монтаж: когда в область отрисовки разом попадает много элементов
 * (резкий зум, выход из обзора), они добавляются порциями по кадрам, а не одним длинным кадром.
 * Ушедшие из области удаляются сразу.
 */

export const MOUNT_PER_FRAME = 40;

export interface MountStep {
  readonly mounted: ReadonlySet<string>;
  /** Остались ещё не смонтированные ключи — нужен следующий кадр. */
  readonly pending: boolean;
}

export function nextMounted(
  previous: ReadonlySet<string>,
  wanted: readonly string[],
  perFrame = MOUNT_PER_FRAME,
): MountStep {
  const wantedSet = new Set(wanted);
  const mounted = new Set<string>();
  for (const key of previous) if (wantedSet.has(key)) mounted.add(key);
  let added = 0;
  let pending = false;
  for (const key of wanted) {
    if (mounted.has(key)) continue;
    if (added === perFrame) {
      pending = true;
      break;
    }
    mounted.add(key);
    added += 1;
  }
  const unchanged = mounted.size === previous.size && added === 0;
  return { mounted: unchanged ? previous : mounted, pending };
}
