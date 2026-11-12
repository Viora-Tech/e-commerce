/** SOURCE OF TRUTH: the courier table's badges — WHAT: Cheapest, Fastest and Recommended among the
 * rate rows that can take the parcel / WHY: the server ranks the rows it quotes, and the courier
 * drawer ranks them again once shipping insurance is added to each price. Pure, browser-safe
 * (`@commerce/core/courier-badges`).
 */
import type { CourierRateRow } from './courier-rates'

/** Cheapest and fastest among the couriers that can take the parcel; recommended is the
 *  cheapest priced one, else the fastest, else the first courier that can take it. */
export function assignBadges(rows: CourierRateRow[]): CourierRateRow[] {
  const bookable = rows.filter((r) => r.problem === null)
  const priced = bookable.filter((r) => r.pricePaise !== null)
  const cheapest = priced.length
    ? priced.reduce((a, b) => ((b.pricePaise as number) < (a.pricePaise as number) ? b : a))
    : null
  const timed = bookable.filter((r) => r.minTransitDays !== null)
  const fastest = timed.length
    ? timed.reduce((a, b) => ((b.minTransitDays as number) < (a.minTransitDays as number) ? b : a))
    : null
  const recommended = cheapest ?? fastest ?? bookable[0] ?? null
  return rows.map((r) => {
    const badges: CourierRateRow['badges'] = []
    if (cheapest === r) badges.push('cheapest')
    if (fastest === r) badges.push('fastest')
    if (recommended === r) badges.push('recommended')
    return { ...r, badges }
  })
}
