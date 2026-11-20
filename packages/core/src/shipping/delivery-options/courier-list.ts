/** SOURCE OF TRUTH: a courier list option's cards — WHAT: `courierList` turns the routes that fit
 * a `list` option into its cards: the pick at the option's price, every other courier at that
 * price plus what it costs the store more, one card per courier and speed, couriers beaten on
 * both price and date dropped (but never below three when three deliver, a different courier
 * coming back before the same courier's other speed), at most `couriers.max` (null: all) /
 * WHY: the shopper must be able to choose from every courier that delivers (owner, 20 Nov 2026).
 * Pure. Split from resolve.ts.
 */
import type { DeliveryOption } from './config'
import type { PricedRoute } from './resolve-types'
import { type PriceRounding, roundPrice } from './rounding'
import type { Route } from './routes'

/** A route that fits the option, priced for it. */
export type Candidate = { route: Route; priced: PricedRoute }

/** A courier list shows at least this many cards when that many couriers can deliver. */
export const MIN_LIST_CARDS = 3

/** What the store pays for a candidate: courier cost plus insurance. */
export const storeCost = (c: Candidate): number =>
  c.priced.courierCostPaise + (c.priced.insurancePaise ?? 0)

/** Cheapest: lowest cost to the store (insurance included), tie → direct. */
export function byCheapest(a: Candidate, b: Candidate): number {
  return (
    storeCost(a) - storeCost(b) ||
    Number(a.route.channel !== 'direct') - Number(b.route.channel !== 'direct') ||
    a.route.key.localeCompare(b.route.key)
  )
}

export { upToNine } from './rounding'

/** How a list card's "+₹" is rounded: the option's rounding, or (on the old ₹10 rule) the
 *  "Round extras up to ₹…9" switch as before. */
const extraRounding = (option: DeliveryOption): PriceRounding =>
  option.price.rounding !== 'ten'
    ? option.price.rounding
    : option.couriers.roundTo9
      ? 'nine'
      : 'off'

/**
 * What paying on delivery adds on this courier: its COD cost over its prepaid cost, rounded up
 * to ₹10; null when it takes no cash on delivery (owner, 20 Nov 2026: COD keeps the courier the
 * shopper picked, it does not switch to another one).
 */
export function codExtraPaise(route: Route): number | null {
  if (route.codAvailable === false) return null
  const prepaid = route.costPaise ?? 0
  const more = Math.max(0, (route.codCostPaise ?? prepaid) - prepaid)
  return Math.ceil(more / 1000) * 1000
}

/** A card's price on cash on delivery; free shipping stays free. */
function withCod(priced: PricedRoute, route: Route, option: DeliveryOption): PricedRoute {
  const extra = codExtraPaise(route)
  const free = option.price.source === 'free' || priced.pricePaise === 0
  return {
    ...priced,
    codPricePaise: extra === null ? null : free ? priced.pricePaise : priced.pricePaise + extra,
  }
}

const later = (p: PricedRoute) => p.latest ?? '9999-12-31'

/** `q` is at most as dear and as late as `p`, and better on one of them. */
const beats = (q: PricedRoute, p: PricedRoute) =>
  q.pricePaise <= p.pricePaise &&
  later(q) <= later(p) &&
  (q.pricePaise < p.pricePaise || later(q) < later(p))

/**
 * The cards of a `list` option: the pick at its own price, every other allowed courier at that
 * price plus what it costs the store more (rounded to ₹…9 when asked). One card per courier and
 * speed (a carrier offered by two apps keeps the cheaper); couriers beaten on both price and
 * date are dropped when asked; at most `max` (null: every one), cheapest first.
 */
export function courierList(
  fits: readonly Candidate[],
  winner: Candidate,
  option: DeliveryOption,
  /** The pick is a rule's preferred courier: its other speeds do not show (owner, 20 Nov 2026:
   *  Delhivery Air chosen for mice, so no Delhivery Surface; other couriers still show). */
  preferred = false,
): PricedRoute[] {
  const base = withCod(winner.priced, winner.route, option)
  const seen = new Set<string>([`${winner.route.carrierKey}:${winner.route.speed}`])
  const rest: PricedRoute[] = []
  const rounding = extraRounding(option)
  for (const c of [...fits].sort(byCheapest)) {
    const id = `${c.route.carrierKey}:${c.route.speed}`
    if (c.route.key === winner.route.key || seen.has(id)) continue
    if (preferred && c.route.carrierKey === winner.route.carrierKey) continue
    seen.add(id)
    // A cheaper courier costs what the pick costs (free when it is free); a dearer one adds
    // the difference (owner, 20 Nov 2026).
    const more =
      option.couriers.extra === 'none' ? 0 : Math.max(0, storeCost(c) - storeCost(winner))
    const extra = roundPrice(more, rounding)
    rest.push(
      withCod(
        {
          ...c.priced,
          pricePaise: base.pricePaise + extra,
          listPricePaise: base.listPricePaise + extra,
        },
        c.route,
        option,
      ),
    )
  }
  const all = [base, ...rest]
  const max = option.couriers.max ?? Number.POSITIVE_INFINITY
  const kept = option.couriers.hideSlowerDearer
    ? all.filter((p) => p === base || !all.some((q) => q !== p && beats(q, p)))
    : all
  /* Never leave the shopper with a single card when couriers are there to choose from (owner,
     19 Nov 2026): when hiding left fewer than MIN_LIST_CARDS, hidden couriers come back. A
     courier not on a card yet comes back before another speed of one that is (owner, 20 Nov:
     Delhivery Express at the same date for +₹9 comes after Blue Dart or Amazon), then the
     cheapest first; each is still priced at the pick plus its difference. */
  const floor = Math.min(MIN_LIST_CARDS, max, all.length)
  const shownCarriers = new Set(kept.map((p) => p.route.carrierKey))
  const hidden = all.filter((p) => !kept.includes(p))
  const back: PricedRoute[] = []
  while (kept.length + back.length < floor && hidden.length > 0) {
    const fresh = hidden.findIndex((p) => !shownCarriers.has(p.route.carrierKey))
    const [next] = hidden.splice(fresh >= 0 ? fresh : 0, 1)
    if (!next) break
    back.push(next)
    shownCarriers.add(next.route.carrierKey)
  }
  // Kept cards cheapest first, then the ones brought back in the order they came back.
  return [...kept, ...back].slice(0, max)
}
