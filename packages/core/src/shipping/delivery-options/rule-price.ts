/** SOURCE OF TRUTH: a product rule's price and the cash on delivery fee — WHAT: which rule prices
 * a cart's products carry for an option (`cartRulePrices`), the price of the first courier under
 * them (`withRulePrice`: Free, Fixed ₹, free above ₹X, or the option's own; the highest wins in a
 * mixed cart) and a COD pick's fee shown as its own charge (`withSeparateCodFee`) / WHY: owner,
 * 20 Nov 2026: "Mice ship free by Delhivery Air", skates pay ₹99, and COD still charges its fee
 * on a free order. Other couriers cost that price plus their difference (`courierList`). Pure.
 */
import type { DeliveryOption, RouteRule, RulePrice } from './config'
import type { PricedRoute } from './resolve-types'
import { roundPrice } from './rounding'
import type { Route } from './routes'
import { type CartItemFacts, RULE_SPECIFICITY, ruleMatchesItem } from './rules'

/** A product with no rule (or a rule saved before rule prices) pays the option's price. */
const OPTION_PRICE: RulePrice = { mode: 'option' }

const changesPrice = (p: RulePrice) => p.mode !== 'option' || p.freeAbovePaise != null

/** The cart's rule prices for one option, and the order value free-above reads. */
export type RulePriceContext = { prices: RulePrice[]; orderValuePaise: number }

/**
 * Every price the cart's products carry for `optionId`: for each product, the price of each of
 * its winning rules (the most specific kind, as `matchRules` decides couriers), and the option's
 * own price for a product no rule matches. Null when none of them changes the price, so a store
 * with no rule prices is priced exactly as before.
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
  for (const item of items) {
    const hits = live.filter((r) => ruleMatchesItem(r, item))
    const best = Math.max(0, ...hits.map((r) => RULE_SPECIFICITY[r.target.kind] ?? 0))
    const winning = hits.filter((r) => (RULE_SPECIFICITY[r.target.kind] ?? 0) === best)
    if (winning.length === 0) out.push(OPTION_PRICE)
    for (const r of winning) out.push(r.price ?? OPTION_PRICE)
  }
  return out.some(changesPrice) ? out : null
}

type Charge = { paise: number; kind: 'option' | 'free' | 'fixed' }

function chargeFor(p: RulePrice, normal: PricedRoute, insurance: number, value: number): Charge {
  if (p.freeAbovePaise != null && value >= p.freeAbovePaise) return { paise: insurance, kind: 'free' }
  if (p.mode === 'free') return { paise: insurance, kind: 'free' }
  if (p.mode === 'fixed') return { paise: (p.fixedPaise ?? 0) + insurance, kind: 'fixed' }
  return { paise: normal.pricePaise, kind: 'option' }
}

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
 * shopper ticks is added to Free and Fixed; insurance a rule requires is the store's. On COD
 * (`priced` is then the prepaid price) the courier's COD charge is added, or kept as its own fee
 * when the option shows it separately; a free rule still charges it.
 */
export function withRulePrice(
  priced: PricedRoute,
  route: Route,
  option: DeliveryOption,
  ctx: RulePriceContext,
  need: { insured: boolean; cod: boolean; required: boolean },
): PricedRoute {
  const insurance =
    need.insured && !need.required && priced.insurancePaise
      ? roundPrice(priced.insurancePaise, option.price.rounding)
      : 0
  const top = ctx.prices
    .map((p) => chargeFor(p, priced, insurance, ctx.orderValuePaise))
    .reduce((a, b) => (b.paise > a.paise || (b.paise === a.paise && b.kind === 'option') ? b : a))
  let price = top.paise
  let list =
    top.kind === 'option'
      ? priced.listPricePaise
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
