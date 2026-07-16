/**
 * A trailing-edge debouncer: `fn` runs once, `waitMs` after the last call.
 * Used for the 3-second autosave so we stay well under the sync write-rate limit.
 */

export interface Debounced<A extends unknown[]> {
  (...args: A): void;
  /** Cancel a pending call without running it. */
  cancel(): void;
  /** Run any pending call immediately (e.g. before the panel closes). */
  flush(): void;
  /** Whether a call is currently scheduled. */
  pending(): boolean;
}

export function debounce<A extends unknown[]>(fn: (...args: A) => void, waitMs: number): Debounced<A> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let lastArgs: A | undefined;

  const run = () => {
    timer = undefined;
    const args = lastArgs;
    lastArgs = undefined;
    if (args) fn(...args);
  };

  const debounced = ((...args: A) => {
    lastArgs = args;
    if (timer) clearTimeout(timer);
    timer = setTimeout(run, waitMs);
  }) as Debounced<A>;

  debounced.cancel = () => {
    if (timer) clearTimeout(timer);
    timer = undefined;
    lastArgs = undefined;
  };

  debounced.flush = () => {
    if (timer) {
      clearTimeout(timer);
      run();
    }
  };

  debounced.pending = () => timer !== undefined;

  return debounced;
}
