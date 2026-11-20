/**
 * How long the oldest order to ship has waited, from the summary's one `needsYou.ordersToShip`
 * read. Ship's "Oldest N days" chip and the Needs you heading both call this, so the page shows
 * one count and one age (live 18 Nov showed 66/92 days in one place and 62/91 in another).
 */

const DAY_MS = 86_400_000

/** Whole days since `oldestAt`; null with no order or under a full day. */
export function shipWaitDays(oldestAt: Date | string | null, now = Date.now()): number | null {
  if (!oldestAt) return null
  const days = Math.floor((now - new Date(oldestAt).getTime()) / DAY_MS)
  return days >= 1 ? days : null
}
