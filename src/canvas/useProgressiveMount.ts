import { useEffect, useRef, useState } from 'react';
import { nextMounted } from './progressiveMount';

const NOTHING: ReadonlySet<string> = new Set();

/** Какие из ключей уже можно рендерить; остальные добавятся в следующих кадрах. */
export function useProgressiveMount(keys: readonly string[]): ReadonlySet<string> {
  const [mounted, setMounted] = useState<ReadonlySet<string>>(NOTHING);
  const mountedRef = useRef(mounted);
  useEffect(() => {
    let frame = 0;
    const step = (): void => {
      const result = nextMounted(mountedRef.current, keys);
      mountedRef.current = result.mounted;
      setMounted(result.mounted);
      if (result.pending) frame = requestAnimationFrame(step);
    };
    step();
    return () => {
      cancelAnimationFrame(frame);
    };
  }, [keys]);
  return mounted;
}
