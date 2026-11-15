import type { LoadFailure } from '@/hooks/use-load'
import { isForbidden } from './forbidden'

/** A server read that failed, as a page tells the member: no access (FORBIDDEN) or plain error. */
export type Failed = { failed: LoadFailure }

/**
 * For a server page's `.catch(...)`: turns the error into `{ failed }`, so the page can show
 * `ServerLoadFailed` ("Could not load …" with Try again, or "You do not have access") in place
 * of claiming the section is unavailable.
 */
export function loadFailure(error: unknown): Failed {
  return { failed: isForbidden(error) ? 'no-access' : 'error' }
}

/** True for what `loadFailure` returned (a page's read answered with data otherwise). */
export function didFail<T>(value: T | Failed): value is Failed {
  return typeof value === 'object' && value !== null && 'failed' in value
}
