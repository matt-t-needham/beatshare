import { useEffect, useRef } from 'react';

/**
 * Run an effect exactly once after mount.
 * Guards against React StrictMode double-invocation in dev.
 */
export function useMount(fn: () => void | (() => void)): void {
  const fired = useRef(false);
  useEffect(() => {
    if (fired.current) return;
    fired.current = true;
    return fn();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
