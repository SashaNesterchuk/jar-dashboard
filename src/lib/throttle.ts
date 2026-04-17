/** @returns ms elapsed since page load (monotonic for scheduling). */
function nowMs(): number {
  return typeof performance !== "undefined" ? performance.now() : Date.now();
}

export type ThrottledFunction<F> = F & { cancel: () => void };

/**
 * Leading + trailing throttle: at most one call per `waitMs`, burst ends with latest args.
 * Use `cancel()` before a logical "stop" (e.g. typing idle) to drop a pending trailing call.
 */
export function throttle<A extends unknown[]>(
  fn: (...args: A) => void,
  waitMs: number
): ThrottledFunction<(...args: A) => void> {
  let lastInvoke = -Infinity;
  let timeout: ReturnType<typeof setTimeout> | null = null;
  let lastArgs: A | null = null;

  const cancel = () => {
    if (timeout !== null) {
      clearTimeout(timeout);
      timeout = null;
    }
    lastArgs = null;
  };

  const wrapped = ((...args: A) => {
    const t = nowMs();
    lastArgs = args;
    const remaining = waitMs - (t - lastInvoke);

    if (remaining <= 0) {
      cancel();
      fn(...args);
      lastInvoke = nowMs();
      lastArgs = null;
    } else if (timeout === null) {
      timeout = setTimeout(() => {
        timeout = null;
        if (lastArgs !== null) {
          fn(...lastArgs);
          lastInvoke = nowMs();
          lastArgs = null;
        }
      }, remaining);
    }
  }) as ThrottledFunction<(...args: A) => void>;

  wrapped.cancel = cancel;
  return wrapped;
}
