import type { LoadFailure } from '@/hooks/use-load'
import { isForbidden } from '@/lib/forbidden'

/** A server page's read that did not answer: why, so the page can say so. */
export type ReadFailure = LoadFailure | 'not-installed'

/** The Inbox app is not installed (the API's PRECONDITION_FAILED from `requireInstalled`). */
function isNotInstalled(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    (error as { code?: unknown }).code === 'PRECONDITION_FAILED'
  )
}

/** Why a read failed: the member's role, the Inbox app missing, or anything else. */
export function readFailure(error: unknown): ReadFailure {
  if (isForbidden(error)) return 'no-access'
  if (isNotInstalled(error)) return 'not-installed'
  return 'error'
}

/**
 * For a Sales channels server page: the read's answer, or why it failed. Before, every failure
 * read as "you need access", so a slow database looked like a missing permission.
 */
export function read<T extends object>(call: Promise<T>): Promise<T | ReadFailure> {
  return call.catch(readFailure)
}

/** The read failed (`read` returned a reason, not an answer). */
export function failed<T extends object>(value: T | ReadFailure): value is ReadFailure {
  return typeof value === 'string'
}
