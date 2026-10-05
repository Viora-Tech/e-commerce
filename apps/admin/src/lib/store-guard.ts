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
