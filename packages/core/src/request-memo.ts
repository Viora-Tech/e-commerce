/** SOURCE OF TRUTH: memoPerRequest, setRequestMemo
 * WHAT:  Reads that many parts of one storefront render repeat (the store's `apps` record is read
 *        by the registries, the theme packs and most apps) answered once per request.
 * WHY:   An uncached storefront page opened about 44 transactions, 14 of them for the same
 *        `store.apps` row (roadmap, speed track step 3).
 *
 * Off unless an app turns it on: `setRequestMemo` takes a function that returns the current
 * request's map, or a fresh one outside a request. The storefront passes React's `cache(() =>
 * new Map())`, which React scopes to one server render and which is a plain call (no memo) in
 * server actions, route handlers without a render, the API and the worker. So nothing memoised
 * here outlives one render, and code that writes (actions, jobs) always reads the database.
 * Only read-only lookups may go through `memoPerRequest`; never a read a caller then writes back.
 */

type RequestMemo = Map<string, Promise<unknown>>

// Not request state: the function that finds the current request's map, set once at start-up.
let currentMemo: (() => RequestMemo) | null = null

/** Turns the memo on for this process (the storefront does, in `lib/store-context.ts`). */
export function setRequestMemo(source: (() => RequestMemo) | null): void {
  currentMemo = source
}

/**
 * `load()` once per request for `key` (the key must name the store). A failed load is
 * forgotten, so a later caller in the same request tries again rather than sharing the error.
 */
export function memoPerRequest<T>(key: string, load: () => Promise<T>): Promise<T> {
  const memo = currentMemo?.()
  if (!memo) return load()
  const hit = memo.get(key)
  if (hit) return hit as Promise<T>
  const next = load()
  memo.set(key, next)
  next.catch(() => {
    if (memo.get(key) === next) memo.delete(key)
  })
  return next
}

/** What this request already loaded or remembered for `key`; undefined when nothing (or off). */
export async function peekPerRequest<T>(key: string): Promise<T | undefined> {
  const hit = currentMemo?.()?.get(key)
  if (!hit) return undefined
  try {
    return (await hit) as T
  } catch {
    return undefined
  }
}

/** Keeps `value` for the rest of this request under `key` (nothing when the memo is off). */
export function rememberPerRequest(key: string, value: unknown): void {
  currentMemo?.()?.set(key, Promise.resolve(value))
}
