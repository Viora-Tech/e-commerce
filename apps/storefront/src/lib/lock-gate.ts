/**
 * Whether a request to a password-locked store is shut out. `/api/*` routes skip the
 * proxy's password page, so a route that returns catalogue data (search suggestions)
 * asks this itself: locked unless the visitor holds the signed pass or a preview token.
 */
export function lockedOut(
  lock: { enabled: boolean },
  passes: { access: boolean; preview: boolean },
): boolean {
  return lock.enabled && !passes.access && !passes.preview
}
