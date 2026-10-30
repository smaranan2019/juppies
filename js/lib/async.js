/** Small helpers for asynchronous work. No app knowledge: safe to use anywhere. */

/**
 * Wraps an async function so only the most recent call's result is used.
 * If a newer call starts before an older one finishes, the older call
 * resolves with `undefined` instead of its (now stale) result.
 *
 *   const loadLatest = latestOnly(fetchEverything);
 *   loadLatest(); loadLatest();  // only the second result is applied
 */
export function latestOnly(asyncFn) {
  let latestCall = 0;
  return async (...args) => {
    const thisCall = ++latestCall;
    const result = await asyncFn(...args);
    return thisCall === latestCall ? result : undefined;
  };
}
