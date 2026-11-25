/**
 * Paging for the in-card histories on the customer page (Store credit, Loyalty points): the
 * newest few lines first, "Show older" asks the server for more. The read asks for one line
 * past what is shown, so the card knows whether older ones exist.
 */

/** Lines a card shows before "Show older". */
export const HISTORY_PAGE = 5

/** Lines each "Show older" adds. */
const HISTORY_STEP = 10

/** The most lines the API serves in one read (`limit` max in the routers). */
const HISTORY_MAX = 200

/** The `limit` to ask for while `shown` lines are open. */
export const historyLimit = (shown: number) => Math.min(shown + 1, HISTORY_MAX)

/** How many lines are open after one more "Show older". */
export const nextShown = (shown: number) => Math.min(shown + HISTORY_STEP, HISTORY_MAX - 1)

/** The lines to draw and whether older ones exist. */
export function historyPage<T>(entries: T[], shown: number): { visible: T[]; hasMore: boolean } {
  return { visible: entries.slice(0, shown), hasMore: entries.length > shown }
}
