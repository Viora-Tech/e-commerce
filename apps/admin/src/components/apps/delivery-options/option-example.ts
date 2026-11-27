/** SOURCE OF TRUTH: the "At checkout, for example" line on the Options page and an option's page
 * WHAT:  What a shopper would see for one option, priced the engine's way (markup, rounding,
 *        price limits, Shipping rate or Free, and for a courier list what a faster courier
 *        costs: the difference, its full price, or nothing extra) from made-up courier costs, so
 *        nothing has to be asked. Mirrors `priceRoute` and `priceFromPick` in the core engine.
 * WHY:   Owner, 21 Nov 2026: the settings read as jargon; one line like "Delhivery Surface ₹49 ·
 *        Delhivery Air + ₹30" shows what a change does. Try a PIN shows real prices.
 * WHERE: option-example-line.tsx. Pure.
 */
import { type DeliveryOption, roundPrice } from '@commerce/core/delivery-options'

/** Made-up courier costs to the store: Surface ₹43, Air ₹72. */
export const EXAMPLE_COSTS = { standard: 4300, express: 7200 } as const

type Speed = keyof typeof EXAMPLE_COSTS

export type ExampleCard = {
  speed: Speed
  /** What the shopper pays; null: the store's Shipping rate (not known here). */
  pricePaise: number | null
  /** What it adds over the first card ("+ ₹30"); null: the card shows its own price. */
  extraPaise: number | null
}

export type OptionExample = {
  cards: ExampleCard[]
  /** The option's free-above threshold, said after the line; null: none. */
  freeAbovePaise: number | null
}

type Pricing = Pick<DeliveryOption, 'price' | 'couriers' | 'speed' | 'strategy'>

const markupOf = (o: Pricing, cost: number) =>
  o.price.markupPaise + Math.ceil((cost * o.price.markupPercent) / 100)

/** Cost + markup rounded the option's way (no limits: what a `full` list charges). */
const ownPrice = (o: Pricing, cost: number) =>
  roundPrice(cost + markupOf(o, cost), o.price.rounding)

/** The first card's price, as `priceRoute` makes it (below any free-above threshold). */
function firstPrice(o: Pricing, cost: number): number | null {
  if (o.price.source === 'free') return 0
  if (o.price.source === 'zone') return null
  let p = ownPrice(o, cost)
  if (o.price.minPaise != null) p = Math.max(p, o.price.minPaise)
  if (o.price.maxPaise != null) p = Math.min(p, o.price.maxPaise)
  return p
}

/** How a list's "+ ₹" is rounded, as the engine's `extraRounding`. */
const extraRounding = (o: Pricing) =>
  o.price.rounding !== 'ten' ? o.price.rounding : o.couriers.roundTo9 ? 'nine' : 'off'

/** The example cards: one for a one-card option, the first and the other speed for a list. */
export function optionExample(o: Pricing): OptionExample {
  // A list capped at one courier ("Can shoppers pick a faster courier? No") shows one card.
  const list = o.couriers.show === 'list' && o.couriers.max !== 1
  const firstSpeed: Speed = list ? (o.strategy === 'fastest' ? 'express' : 'standard') : o.speed
  const base = firstPrice(o, EXAMPLE_COSTS[firstSpeed])
  const first: ExampleCard = { speed: firstSpeed, pricePaise: base, extraPaise: null }
  const freeAbovePaise = o.price.source === 'free' ? null : (o.price.freeAbovePaise ?? null)
  if (!list) return { cards: [first], freeAbovePaise }
  const otherSpeed: Speed = firstSpeed === 'standard' ? 'express' : 'standard'
  const cost = EXAMPLE_COSTS[otherSpeed]
  const more = Math.max(0, cost - EXAMPLE_COSTS[firstSpeed])
  const extra = o.couriers.extra
  let other: ExampleCard
  if (extra === 'own') {
    // Every other courier at its own price, cheaper for the store or not (owner, 28 Nov 2026).
    other = {
      speed: otherSpeed,
      pricePaise: Math.max(base ?? 0, ownPrice(o, cost)),
      extraPaise: null,
    }
  } else if (more === 0 || extra === 'none') {
    other = { speed: otherSpeed, pricePaise: base, extraPaise: null }
  } else if (extra === 'full') {
    other = {
      speed: otherSpeed,
      pricePaise: Math.max(base ?? 0, ownPrice(o, cost)),
      extraPaise: null,
    }
  } else {
    const add = roundPrice(more, extraRounding(o))
    other = { speed: otherSpeed, pricePaise: base === null ? null : base + add, extraPaise: add }
  }
  return { cards: [first, other], freeAbovePaise }
}
