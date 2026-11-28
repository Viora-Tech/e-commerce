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
import { type CardPricer, codExtraPaise } from './rule-price'

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

/** What an `own` card adds besides the courier's shipping (`priceFromPick`). */
export type OwnExtras = {
  /** The cart's packing (`packingFor`), charged on every card. */
  packingPaise: number
  /** The shopper pays the courier's insurance (ticked, not required by a rule). */
  insurance: boolean
}

const NO_EXTRAS: OwnExtras = { packingPaise: 0, insurance: true }

/**
 * A courier's own price on an `own` list: its shipping and markup rounded the option's way plus
 * the cart's packing, and its insurance rounded the same way on its own, so two couriers of one
 * aggregator add the same insurance (owner, 28 Nov 2026: Amazon and Ekart both via RapidShyp).
 */
export function ownPricePaise(c: Candidate, option: DeliveryOption, extras: OwnExtras): number {
  const cost = c.priced.courierCostPaise
  const markup = option.price.markupPaise + Math.ceil((cost * option.price.markupPercent) / 100)
  const insurance = extras.insurance ? (c.priced.insurancePaise ?? 0) : 0
  return (
    roundPrice(cost + markup, option.price.rounding) +
    extras.packingPaise +
    (insurance > 0 ? roundPrice(insurance, option.price.rounding) : 0)
  )
}

/**
 * What a `difference` card adds to the pick: the shipping it costs the store more and the
 * insurance it costs more, each at least ₹0 and each rounded the option's way on its own, so a
 * cheaper courier's shipping never hides or grows its insurance (owner, 28 Nov 2026: Amazon and
 * Ekart, both RapidShyp at the same insurance rate, showed +₹49 and +₹59 against Delhivery).
 */
export function differenceExtraPaise(
  c: Candidate,
  winner: Candidate,
  option: DeliveryOption,
): number {
  const how = extraRounding(option)
  const freight = Math.max(0, c.priced.courierCostPaise - winner.priced.courierCostPaise)
  const insurance = Math.max(
    0,
    (c.priced.insurancePaise ?? 0) - (winner.priced.insurancePaise ?? 0),
  )
  return roundPrice(freight, how) + roundPrice(insurance, how)
}

/**
 * A card priced from the pick: a cheaper courier costs what the pick costs (free when it is
 * free). A dearer one adds the difference, shipping and insurance each rounded the option's way
 * (`difference`, owner 20 and 28 Nov 2026: `differenceExtraPaise`), costs its own full price but never less than the pick (`full`, owner 21 Nov 2026), or
 * costs what the pick costs (`none`). `own`: every other courier, cheaper or dearer, costs its
 * own price (`ownPricePaise`), never less than the pick (owner, 28 Nov 2026).
 */
export function priceFromPick(
  c: Candidate,
  winner: Candidate,
  option: DeliveryOption,
  extras: OwnExtras = NO_EXTRAS,
): PricedRoute {
  const mode = option.couriers.extra
  if (mode === 'own') {
    const price = Math.max(winner.priced.pricePaise, ownPricePaise(c, option, extras))
    return { ...c.priced, pricePaise: price, listPricePaise: price }
  }
  const more = Math.max(0, storeCost(c) - storeCost(winner))
  if (mode === 'full' && more > 0) {
    const own = fullPricePaise(c, option)
    return {
      ...c.priced,
      pricePaise: Math.max(winner.priced.pricePaise, own),
      listPricePaise: Math.max(winner.priced.listPricePaise, own),
    }
  }
  const extra = mode === 'difference' ? differenceExtraPaise(c, winner, option) : 0
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
  /** A Fixed rule names couriers' own prices (`ruleCardPricer`); null: all from the pick. */
  cardPrice: CardPricer | null = null,
  /** What an `own` card adds besides shipping. */
  extras: OwnExtras = NO_EXTRAS,
): PricedRoute[] {
  const base = withCod(winner.priced, winner.route, option, rulePriced)
  const seen = new Set<string>([`${winner.route.carrierKey}:${winner.route.speed}`])
  const rest: PricedRoute[] = []
  for (const c of [...fits].sort(byCheapest)) {
    const id = `${c.route.carrierKey}:${c.route.speed}`
    if (c.route.key === winner.route.key || seen.has(id)) continue
    if (preferred && c.route.carrierKey === winner.route.carrierKey) continue
    seen.add(id)
    const fromPick = priceFromPick(c, winner, option, extras)
    const card = cardPrice ? cardPrice(c, fromPick) : fromPick
    rest.push(withCod(card, c.route, option, rulePriced))
  }
  /* Another speed of the same courier at the same price that arrives later is never a choice
     worth showing: Blue Dart Air at ₹139 arriving after Blue Dart Surface at ₹139 (owner, 21 Nov
     2026). Dropped always, and never brought back to fill the list. A dearer speed stays even
     when its date is later: aggregator dates are not reliable enough to hide it on (RapidShyp
     gave Blue Dart Air to Kochi 9 days, Surface 6; owner, 21 Nov 2026). */
  const all = [base, ...rest].filter(
    (p) =>
      p === base ||
      ![base, ...rest].some(
        (q) =>
          q !== p &&
          q.route.carrierKey === p.route.carrierKey &&
          q.pricePaise === p.pricePaise &&
          beats(q, p),
      ),
  )
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
