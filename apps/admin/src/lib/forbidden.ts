/**
 * "This member's role does not allow it": the API's FORBIDDEN, as a client call rejects with it
 * (`code`) or as a server render passes it to the route's error page (`digest`, set by `call` in
 * `lib/api.ts`, because production builds blank a server error's message).
 */
export const FORBIDDEN_DIGEST = 'KOOMERCE_FORBIDDEN'

export function isForbidden(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false
  const e = error as { code?: unknown; digest?: unknown }
  return e.code === 'FORBIDDEN' || e.digest === FORBIDDEN_DIGEST
}

/** The API's NOT_FOUND as a client call rejects with it: the record does not exist (any more). */
export function isNotFound(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false
  return (error as { code?: unknown }).code === 'NOT_FOUND'
}
