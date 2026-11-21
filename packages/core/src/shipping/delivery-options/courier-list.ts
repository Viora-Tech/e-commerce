/** SOURCE OF TRUTH: a courier list option's cards — WHAT: `courierList` turns the routes that fit
 * a `list` option into its cards: the pick at the option's price, every other courier at that
 * price plus what it costs the store more (or its own full price), one card per courier and speed, couriers beaten on
 * both price and date dropped (but never below three when three deliver, a different courier
 * coming back before the same courier's other speed), at most `couriers.max` (null: all) /
 * WHY: the shopper must be able to choose from every courier that delivers (owner, 20 Nov 2026).
 * Pure. Split from resolve.ts.
 */
import type { DeliveryOption } from './config'
import type { PricedRoute } from './resolve-types'
import { type PriceRounding, roundPrice } from './rounding'
import type { Route } from './routes'
import { codExtraPaise } from './rule-price'

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

export { codExtraPaise } from './rule-price'

/**
 * A card's price on cash on delivery. The option shows the courier's COD charge separately:
 * the card keeps its price and carries the charge as `codFeePaise`. Else it is added to the
 * card; free shipping stays free, except under a product rule's price (owner, 20 Nov 2026:
 * COD still charges its fee on a free rule).
 */
function withCod(
  priced: PricedRoute,
  route: Route,
  option: DeliveryOption,
  rulePriced: boolean,
): PricedRoute {
  const extra = codExtraPaise(route)
  if (extra === null) return { ...priced, codPricePaise: null }
  if (option.cod.fee === 'separate') {
    return { ...priced, codPricePaise: priced.pricePaise, codFeePaise: extra > 0 ? extra : null }
  }
  const free = !rulePriced && (option.price.source === 'free' || priced.pricePaise === 0)
  return { ...priced, codPricePaise: free ? priced.pricePaise : priced.pricePaise + extra }
}

/** What a courier costs the shopper on its own: its cost and insurance plus the option's markup,
 *  rounded the option's way (the full price a `full` list charges for a dearer courier). */
export function fullPricePaise(c: Candidate, option: DeliveryOption): number {
  const cost = c.priced.courierCostPaise
  const markup = option.price.markupPaise + Math.ceil((cost * option.price.markupPercent) / 100)
  return roundPrice(storeCost(c) + markup, option.price.rounding)
}

/**
 * A card priced from the pick: a cheaper courier costs what the pick costs (free when it is
 * free). A dearer one adds the difference rounded the option's way (`difference`, owner 20 Nov
 * 2026), costs its own full price but never less than the pick (`full`, owner 21 Nov 2026), or
 * costs what the pick costs (`none`).
 */
export function priceFromPick(
  c: Candidate,
  winner: Candidate,
  option: DeliveryOption,
): PricedRoute {
  const more = Math.max(0, storeCost(c) - storeCost(winner))
  const mode = option.couriers.extra
  if (mode === 'full' && more > 0) {
    const own = fullPricePaise(c, option)
    return {
      ...c.priced,
      pricePaise: Math.max(winner.priced.pricePaise, own),
      listPricePaise: Math.max(winner.priced.listPricePaise, own),
    }
  }
  const extra = mode === 'difference' ? roundPrice(more, extraRounding(option)) : 0
  return {
    ...c.priced,
    pricePaise: winner.priced.pricePaise + extra,
    listPricePaise: winner.priced.listPricePaise + extra,
  }
}

const later = (p: PricedRoute) => p.latest ?? '9999-12-31'

/** `q` is at most as dear and as late as `p`, and better on one of them. */
const beats = (q: PricedRoute, p: PricedRoute) =>
  q.pricePaise <= p.pricePaise &&
  later(q) <= later(p) &&
  (q.pricePaise < p.pricePaise || later(q) < later(p))

/**
 * The cards of a `list` option: the pick at its own price, every other allowed courier priced
 * from it (`priceFromPick`: plus the difference, its own full price, or the same). One card per courier and
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
  /** The pick is priced by a product rule (`withRulePrice`). */
  rulePriced = false,
): PricedRoute[] {
  const base = withCod(winner.priced, winner.route, option, rulePriced)
  const seen = new Set<string>([`${winner.route.carrierKey}:${winner.route.speed}`])
  const rest: PricedRoute[] = []
  for (const c of [...fits].sort(byCheapest)) {
    const id = `${c.route.carrierKey}:${c.route.speed}`
    if (c.route.key === winner.route.key || seen.has(id)) continue
    if (preferred && c.route.carrierKey === winner.route.carrierKey) continue
    seen.add(id)
    rest.push(withCod(priceFromPick(c, winner, option), c.route, option, rulePriced))
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
