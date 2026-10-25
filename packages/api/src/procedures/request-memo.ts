/**
 * Answers shared by every procedure call inside ONE request: the signed-in session and the
 * caller's store membership. An admin page makes several store calls at once (layout and page,
 * often five to ten), and each used to read the session, Better Auth's full organization and
 * the store id again. The host creates one memo per request (`createRequestMemo()` in the
 * admin's cached `serverContext`, or per HTTP call in the RPC route) and never shares it across
 * requests, so nothing here outlives the request or reaches another member or store.
 *
 * Only identity lookups are memoised. Permissions are still read inside each call's own store
 * transaction, so a revoked grant takes effect on the next call as before.
 */
export type RequestMemo = Map<string, Promise<unknown>>

export function createRequestMemo(): RequestMemo {
  return new Map()
}

/**
 * `load()` once per key for this request; concurrent callers share the in-flight promise. A
 * failure is not kept, so a later call in the same request tries again.
 */
export function remember<T>(
  memo: RequestMemo | undefined,
  key: string,
  load: () => Promise<T>,
): Promise<T> {
  if (!memo) return load()
  const hit = memo.get(key) as Promise<T> | undefined
  if (hit) return hit
  const pending = load()
  memo.set(key, pending)
  pending.catch(() => {
    if (memo.get(key) === pending) memo.delete(key)
  })
  return pending
}
