/**
 * Fresh data when the merchant comes back to the admin tab (#1410). Pages are server components,
 * so `router.refresh()` reads them again while every client state (open menus, typed text,
 * scroll) stays as it is. This module holds what the one `RefreshOnFocus` in the admin layout
 * decides with: when the page was last read, and whether a form has unsaved changes.
 */

/** Come back sooner than this and the page is still fresh enough: no refresh. */
export const STALE_MS = 30_000

/**
 * Pages that keep themselves current (Live view polls every 15 s) or must never re-render under
 * the merchant (the dev block editor). The theme and code editors sit outside the admin layout.
 */
const SELF_UPDATING = ['/analytics/live', '/dev/editor']

/** Fired on `window` after a focus refresh, for lists that keep their rows in client state. */
export const ADMIN_REFRESH_EVENT = 'admin:refresh'

let lastRead = Date.now()
let unsaved = 0

/** The page was just read: a navigation, a focus refresh, or a page's own poll. */
export function noteRefreshed(): void {
  lastRead = Date.now()
}

/** A form with unsaved changes (every SaveBar's LeaveGuard): no refresh until it is released. */
export function holdForUnsaved(): () => void {
  unsaved += 1
  let released = false
  return () => {
    if (released) return
    released = true
    unsaved -= 1
  }
}

export type RefreshFacts = {
  now: number
  pathname: string
  online: boolean
  /** A dialog is open (a confirm, a sheet): its contents must not move under the merchant. */
  dialogOpen: boolean
}

/** Refresh now? Stale, online, nothing unsaved or open, and not a page that updates itself. */
export function shouldRefresh(f: RefreshFacts): boolean {
  if (!f.online || f.dialogOpen || unsaved > 0) return false
  if (f.now - lastRead < STALE_MS) return false
  return !SELF_UPDATING.some((p) => f.pathname === p || f.pathname.startsWith(`${p}/`))
}
