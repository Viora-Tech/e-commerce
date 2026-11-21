/** SOURCE OF TRUTH: a product rule's price and the cash on delivery fee — WHAT: which rule prices
 * a cart's products carry for an option (`cartRulePrices`), the price of the first courier under
 * them (`withRulePrice`: Free, Fixed ₹, free above ₹X, or the option's own; the highest wins in a
 * mixed cart) and a COD pick's fee shown as its own charge (`withSeparateCodFee`) / WHY: owner,
 * 20 Nov 2026: "Mice ship free by Delhivery Air", skates pay ₹99, and COD still charges its fee
 * on a free order. Other couriers cost that price plus their difference (`courierList`).
 * Owner, 21 Nov 2026: a Fixed rule may name couriers' own prices ("Delhivery ₹99, Blue Dart
 * ₹139": `ruleCardPricer` prices those cards) and any rule but Free may add a packing charge
 * (switches packed in a box), each rule's once, after rounding (₹49 + ₹20 = ₹69). Pure.
 */
import { type DeliveryOption, type RouteRule, RULE_SPECIFICITY, type RulePrice } from './config'
import type { PricedRoute } from './resolve-types'
import { roundPrice } from './rounding'
import type { Route } from './routes'
import { type CartItemFacts, ruleMatchesItem } from './rules'

/** A product with no rule (or a rule saved before rule prices) pays the option's price. */
const OPTION_PRICE: RulePrice = { mode: 'option' }

const changesPrice = (p: RulePrice) =>
  p.mode !== 'option' || p.freeAbovePaise != null || (p.packingPaise ?? 0) > 0

/** The cart's rule prices for one option, and the order value free-above reads. */
export type RulePriceContext = { prices: RulePrice[]; orderValuePaise: number }

/**
 * Every price the cart's products carry for `optionId`: for each product, the price of each of
 * its winning rules (the most specific kind, as `matchRules` decides couriers), and the option's
 * own price for a product no rule matches. Each rule's price is listed once however many of
 * its products are in the cart (its packing is charged once). Null when none of them changes
 * the price, so a store with no rule prices is priced exactly as before.
 */
export function cartRulePrices(
  rules: readonly RouteRule[],
  optionId: string,
  items: readonly CartItemFacts[],
): RulePrice[] | null {
  const live = rules.filter(
    (r) => r.enabled && (r.optionIds === 'all' || r.optionIds.includes(optionId)),
  )
  const out: RulePrice[] = []
  const seen = new Set<string>()
  let unruled = false
  for (const item of items) {
    const hits = live.filter((r) => ruleMatchesItem(r, item))
    const best = Math.max(0, ...hits.map((r) => RULE_SPECIFICITY[r.target.kind] ?? 0))
    const winning = hits.filter((r) => (RULE_SPECIFICITY[r.target.kind] ?? 0) === best)
    if (winning.length === 0 && !unruled) {
      unruled = true
      out.push(OPTION_PRICE)
    }
    for (const r of winning) {
      if (seen.has(r.id)) continue
      seen.add(r.id)
      out.push(r.price ?? OPTION_PRICE)
    }
  }
  return out.some(changesPrice) ? out : null
}

type Charge = { paise: number; kind: 'option' | 'free' | 'fixed' }

/** The price is ₹0: Free, or free above ₹X reached. */
const isFree = (p: RulePrice, value: number) =>
  p.mode === 'free' || (p.freeAbovePaise != null && value >= p.freeAbovePaise)

/** A courier's own fixed price on a Fixed rule (keyed by carrier, any speed), else undefined. */
const ownFixed = (p: RulePrice, carrier: string | undefined, value: number) =>
  p.mode === 'fixed' && carrier != null && !isFree(p, value) ? p.courierPaise?.[carrier] : undefined

/** Free includes everything, insurance too: the store pays it (owner, 21 Nov 2026: "if I say a
 *  delivery is free then I am including everything"). Fixed ₹X (or the courier's own fixed
 *  price when `carrier` is named) adds the insurance ticked. Packing is added separately. */
function chargeFor(
  p: RulePrice,
  normal: PricedRoute,
  insurance: number,
  value: number,
  carrier?: string,
): Charge {
  if (isFree(p, value)) return { paise: 0, kind: 'free' }
  if (p.mode === 'fixed') {
    const fixed = ownFixed(p, carrier, value) ?? p.fixedPaise ?? 0
    return { paise: fixed + insurance, kind: 'fixed' }
  }
  return { paise: normal.pricePaise, kind: 'option' }
}

/** The cart's packing: every rule price's packing charge (each rule once), except a price that
 *  is ₹0 (Free includes everything). Added after rounding: ₹49 + ₹20 packing = ₹69. */
export function packingFor(ctx: RulePriceContext): number {
  return ctx.prices
    .filter((p) => !isFree(p, ctx.orderValuePaise))
    .reduce((sum, p) => sum + (p.packingPaise ?? 0), 0)
}

type Need = { insured: boolean; required: boolean }

/** The insurance the shopper ticked, rounded the option's way; ₹0 when a rule requires it. */
const tickedInsurance = (priced: PricedRoute, option: DeliveryOption, need: Need) =>
  need.insured && !need.required && priced.insurancePaise
    ? roundPrice(priced.insurancePaise, option.price.rounding)
    : 0

/** What paying on delivery adds on this courier (its COD cost over prepaid, up to ₹10); null:
 *  no cash on delivery. */
export function codExtraPaise(route: Route): number | null {
  if (route.codAvailable === false) return null
  const prepaid = route.costPaise ?? 0
  const more = Math.max(0, (route.codCostPaise ?? prepaid) - prepaid)
  return Math.ceil(more / 1000) * 1000
}

/** A COD pick priced at the prepaid price: the courier's COD charge as its own fee line. */
export function withSeparateCodFee(priced: PricedRoute, route: Route): PricedRoute {
  const fee = codExtraPaise(route) ?? 0
  return {
    ...priced,
    courierCostPaise: route.codCostPaise ?? route.costPaise ?? priced.courierCostPaise,
    codFeePaise: fee > 0 ? fee : null,
  }
}

/**
 * The first courier's price under the cart's rule prices: each price's charge (Free: ₹0, Fixed:
 * its amount, free above ₹X: ₹0 from X, the option's own: as priced), the highest winning
 * (owner, 20 Nov 2026: a free mouse with paid skates pays the skates' price). Insurance the
 * shopper ticks is added to Fixed; Free covers it (the store pays); insurance a rule requires is
 * the store's. A Fixed rule naming this courier charges its own price. The cart's packing
 * (`packingFor`) is added on top. On COD (`priced` is then the prepaid price) the courier's COD
 * charge is added, or kept as its own fee when the option shows it separately; a free rule
 * still charges it.
 */
export function withRulePrice(
  priced: PricedRoute,
  route: Route,
  option: DeliveryOption,
  ctx: RulePriceContext,
  need: { insured: boolean; cod: boolean; required: boolean },
): PricedRoute {
  const insurance = tickedInsurance(priced, option, need)
  const top = ctx.prices
    .map((p) => chargeFor(p, priced, insurance, ctx.orderValuePaise, route.carrierKey))
    .reduce((a, b) => (b.paise > a.paise || (b.paise === a.paise && b.kind === 'option') ? b : a))
  const packing = packingFor(ctx)
  let price = top.paise + packing
  let list =
    top.kind === 'option'
      ? priced.listPricePaise + packing
      : top.kind === 'free'
        ? Math.max(priced.listPricePaise, price)
        : price
  if (!need.cod) return { ...priced, pricePaise: price, listPricePaise: Math.max(list, price) }
  if (option.cod.fee === 'separate') {
    return withSeparateCodFee({ ...priced, pricePaise: price, listPricePaise: list }, route)
  }
  const fee = codExtraPaise(route) ?? 0
  price += fee
  list += fee
  return {
    ...priced,
    pricePaise: price,
    listPricePaise: Math.max(list, price),
    courierCostPaise: route.codCostPaise ?? route.costPaise ?? priced.courierCostPaise,
  }
}

/** Prices another courier's card from the pick's card (`priceFromPick`'s result). */
export type CardPricer = (
  c: { route: Route; priced: PricedRoute },
  fromPick: PricedRoute,
) => PricedRoute

/**
 * The other couriers' card prices when a Fixed rule in the cart names couriers (null when none
 * does: every card is `priceFromPick`, as before). For each rule price, a courier the rule
 * names costs its own fixed price plus the insurance ticked (no difference added); any other
 * price charges what it charges the pick (the rule's Fixed ₹X for a Fixed rule) plus the
 * difference `priceFromPick` added. The highest wins, plus the cart's packing. `before` is the
 * pick priced the option's way (before the rule price), `after` the pick at the rule's price.
 */
export function ruleCardPricer(
  before: PricedRoute,
  after: PricedRoute,
  option: DeliveryOption,
  ctx: RulePriceContext,
  need: Need,
): CardPricer | null {
  const names = ctx.prices.some(
    (p) => p.mode === 'fixed' && Object.keys(p.courierPaise ?? {}).length > 0,
  )
  if (!names) return null
  const value = ctx.orderValuePaise
  const pickInsurance = tickedInsurance(before, option, need)
  const packing = packingFor(ctx)
  return (c, fromPick) => {
    const lift = fromPick.pricePaise - after.pricePaise
    const insurance = tickedInsurance(c.priced, option, need)
    let top = Number.NEGATIVE_INFINITY
    let own = false
    for (const p of ctx.prices) {
      const named = ownFixed(p, c.route.carrierKey, value)
      const paise =
        named != null ? named + insurance : chargeFor(p, before, pickInsurance, value).paise + lift
      if (paise > top || (paise === top && named == null)) {
        top = paise
        own = named != null
      }
    }
    const price = top + packing
    const struck = Math.max(0, fromPick.listPricePaise - fromPick.pricePaise)
    return { ...fromPick, pricePaise: price, listPricePaise: own ? price : price + struck }
  }
}
