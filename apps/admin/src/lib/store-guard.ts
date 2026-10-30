import 'server-only'
import { isNoStoreError } from '@commerce/api'

/**
 * For a server page's `.catch(...)`: when the call failed only because there is no store to
 * work in (none picked, no longer a member), resolve to `fallback` so the page can send the
 * member to the store picker. Any other error is rethrown, so it reaches the error page and
 * error tracking instead of bouncing the member to the picker forever with no trace.
 */
export function orNoStore<T>(fallback: T) {
  return (error: unknown): T => {
    if (isNoStoreError(error)) return fallback
    throw error
  }
}

/**
 * `orNoStore` for a page that loads one record by the id in its address: a malformed id
 * (/orders/abandoned, /products/xyz) resolves to null, so the page calls notFound() and shows
 * "Page not found" instead of crashing with a React error (audit #36).
 */
export function orNoStoreOrMissing<T>(fallback: T) {
  return (error: unknown): T | null => {
    if (isInvalidInput(error)) return null
    return orNoStore(fallback)(error)
  }
}

/** The API refused the call's input (e.g. an id that is not a UUID). */
function isInvalidInput(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  const e = error as { code?: unknown; message?: unknown }
  return e.code === 'BAD_REQUEST' && /input validation/i.test(String(e.message ?? ''))
}
