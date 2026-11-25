/**
 * Paging for the shopper's long account histories (Store credit, Points): the newest page
 * first, then "Show older" links `?show=` with ten more. Server-side: the page reads one line
 * past what it shows, so it knows whether older ones exist, and never the whole ledger.
 */

/** Lines a history shows first. */
export const ACCOUNT_HISTORY_PAGE = 10

/** The most lines one page view reads. */
const MAX_SHOWN = 199

/** How many lines to show for the `?show=` search param (one page when missing or junk). */
export function shownFrom(param: string | string[] | undefined): number {
  const raw = Array.isArray(param) ? param[0] : param
  const n = Math.floor(Number(raw))
  if (!Number.isFinite(n) || n < ACCOUNT_HISTORY_PAGE) return ACCOUNT_HISTORY_PAGE
  return Math.min(n, MAX_SHOWN)
}

/** The read's `limit` while `shown` lines are open. */
export const historyLimit = (shown: number) => shown + 1

/** The lines to draw and the link to the next older ones (null at the end). */
export function accountHistory<T>(
  entries: T[],
  shown: number,
): { visible: T[]; moreHref: string | null } {
  const more = entries.length > shown && shown < MAX_SHOWN
  return {
    visible: entries.slice(0, shown),
    moreHref: more ? `?show=${Math.min(shown + ACCOUNT_HISTORY_PAGE, MAX_SHOWN)}` : null,
  }
}
