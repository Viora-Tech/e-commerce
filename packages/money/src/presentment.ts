import { isCurrency, minorDigits } from './currencies'
import { formatMoney } from './format'

/*
 * Market prices (Settings → Markets): a rupee price in a market's currency, Shopify Markets
 * style. Rupees × the market's rate (its fixed rate, else the day's reference rate) × its price
 * adjustment, then its rounding. Prices, reports and GST stay in paise; only what a shopper
 * abroad sees is converted, by this one rule on the store, cart and checkout. Market rows and
 * reference rates are read in @commerce/core (`marketPricing`, `storeMarketPricing`).
 */

export type MarketRoundingRule = 'none' | 'whole' | 'x99'

/** How one market prices: what `presentmentMinor` needs. */
export type MarketPricing = {
  /** ISO 4217 code the shopper sees. */
  currency: string
  /** Units of `currency` per rupee. */
  rate: number
  /** Basis points on top of the converted price: +1000 is 10% above. */
  adjustmentBp: number
  rounding: MarketRoundingRule
  /**
   * Markets › Catalogs: a variant's fixed price in `currency` minor units, by variant id. Shown
   * as typed (no rate, adjustment or rounding) wherever the variant is known.
   */
  fixedMinor?: Readonly<Record<string, number>> | undefined
}

/** Rupees as rupees: the primary market, or a market whose rate is not known yet. */
export const RUPEE_PRICING: MarketPricing = {
  currency: 'INR',
  rate: 1,
  adjustmentBp: 0,
  rounding: 'none',
}

/** True when prices show as stored, in rupees. */
function isRupeePricing(p: MarketPricing): boolean {
  return p.currency === 'INR' && p.rate === 1 && p.adjustmentBp === 0
}

/**
 * Paise in the market's currency, as whole minor units. Rounding comes last, after the rate
 * and the adjustment: `whole` to the nearest whole unit (14.27 → 14.00), `x99` up to the next
 * .99 (14.27 → 14.99, 14.00 → 14.99; whole units for a currency without decimals). Zero and
 * negative amounts (a discount line) keep their sign and are rounded by the same rule.
 */
export function presentmentMinor(paise: number, p: MarketPricing, variantId?: string): number {
  // A catalog's fixed price for this variant (one unit's price, never a line or a discount).
  const fixed = variantId ? p.fixedMinor?.[variantId] : undefined
  if (fixed !== undefined && paise > 0) return fixed
  if (isRupeePricing(p)) return paise
  if (paise === 0) return 0
  const sign = paise < 0 ? -1 : 1
  const digits = minorDigits(p.currency)
  const scale = 10 ** digits
  const major = (Math.abs(paise) / 100) * p.rate * (1 + p.adjustmentBp / 10_000)
  let units: number
  if (p.rounding === 'whole') units = Math.round(major) * scale
  else if (p.rounding === 'x99') {
    // .99 of the unit: 1 cent off the next whole dollar, 10 fils off the next whole dinar.
    units = digits === 0 ? Math.ceil(major) : (Math.floor(major + 1e-9) + 1) * scale - scale / 100
  } else units = Math.round(major * scale)
  return sign * Math.max(units, 0)
}

/**
 * A price as Liquid holds money: hundredths of the market's currency (Shopify's subunit
 * amounts, also for dinars and yen), so a theme's `| money` and its scripts divide by 100.
 * Rupees stay paise.
 */
export function presentmentCents(
  paise: number,
  p: MarketPricing | null,
  variantId?: string,
): number {
  if (!p) return paise
  if (isRupeePricing(p) && !(variantId && p.fixedMinor?.[variantId] !== undefined)) return paise
  return Math.round((presentmentMinor(paise, p, variantId) / 10 ** minorDigits(p.currency)) * 100)
}

/** Paise as a shopper in this market reads them (`AED 23.50`); rupees without a market. */
export function formatPresentment(
  paise: number,
  p: MarketPricing | null,
  /** The variant whose one unit this is: a catalog's fixed price for it wins. */
  variantId?: string,
): string {
  if (!p || !isCurrency(p.currency)) return formatMoney(paise, 'INR')
  const fixed = variantId !== undefined && p.fixedMinor?.[variantId] !== undefined
  if (isRupeePricing(p) && !fixed) return formatMoney(paise, 'INR')
  return formatMoney(presentmentMinor(paise, p, variantId), p.currency)
}

/*
 * Cart lines in a market (Markets › Catalogs): a catalog's fixed price is one unit's, so a line
 * with one is that times the quantity, and the subtotal adds the lines up, the same sums the
 * Liquid cart makes (`toLiquidCart`). Without fixed prices every amount converts as it did.
 * Display only: checkout still charges the rupee amounts.
 */

/** One cart line, as these sums need it. */
export type PresentmentLine = {
  variantId: string
  unitPricePaise: number
  quantity: number
  linePaise: number
}

/** True when the market's catalog fixes this variant's price. */
export function hasFixedPrice(p: MarketPricing | null, variantId: string): boolean {
  return p?.fixedMinor?.[variantId] !== undefined
}

/** A line in the market's currency minor units: the fixed unit price × quantity, else converted. */
export function presentmentLineMinor(line: PresentmentLine, p: MarketPricing): number {
  return hasFixedPrice(p, line.variantId)
    ? presentmentMinor(line.unitPricePaise, p, line.variantId) * line.quantity
    : presentmentMinor(line.linePaise, p)
}

/**
 * An amount built on the cart's subtotal (the subtotal itself, the total, what is left to pay)
 * in the market's minor units. With a fixed price in the cart the subtotal is the lines added
 * up, and the amount moves by as much as the subtotal did; never below zero. Without one, the
 * amount converts on its own, as before.
 */
export function presentmentCartMinor(
  paise: number,
  lines: readonly PresentmentLine[],
  subtotalPaise: number,
  p: MarketPricing,
): number {
  if (!lines.some((l) => hasFixedPrice(p, l.variantId))) return presentmentMinor(paise, p)
  const subtotal = lines.reduce((n, l) => n + presentmentLineMinor(l, p), 0)
  const shift = subtotal - presentmentMinor(subtotalPaise, p)
  return Math.max(0, presentmentMinor(paise, p) + shift)
}

/** A cart line's total as a shopper in this market reads it; rupees without a market. */
export function formatPresentmentLine(line: PresentmentLine, p: MarketPricing | null): string {
  if (!p || !isCurrency(p.currency) || !hasFixedPrice(p, line.variantId)) {
    return formatPresentment(line.linePaise, p)
  }
  return formatMoney(presentmentLineMinor(line, p), p.currency)
}

/** `presentmentCartMinor` formatted: the cart's subtotal, total or amount to pay. */
export function formatPresentmentCart(
  paise: number,
  lines: readonly PresentmentLine[],
  subtotalPaise: number,
  p: MarketPricing | null,
): string {
  if (!p || !isCurrency(p.currency) || !lines.some((l) => hasFixedPrice(p, l.variantId))) {
    return formatPresentment(paise, p)
  }
  return formatMoney(presentmentCartMinor(paise, lines, subtotalPaise, p), p.currency)
}

/**
 * A product's "From" price on a card: the variant whose one unit reads lowest in this market
 * (its fixed price, else converted; rupees without a market), and whether the variants' prices
 * read differently at all. Null when no variant has a price.
 */
export function lowestPresentment(
  variants: readonly { id: string; pricePaise: number }[],
  p: MarketPricing | null,
): { id: string; pricePaise: number; varies: boolean } | null {
  const shown = variants.map((v) => ({
    ...v,
    minor: p ? presentmentMinor(v.pricePaise, p, v.id) : v.pricePaise,
  }))
  const [first, ...rest] = shown
  if (!first) return null
  const lowest = rest.reduce((low, v) => (v.minor < low.minor ? v : low), first)
  return {
    id: lowest.id,
    pricePaise: lowest.pricePaise,
    varies: rest.some((v) => v.minor !== first.minor),
  }
}

/**
 * "Save AED 7.73": the gap between the two prices as the shopper reads them, each converted
 * and rounded first. Converting the paise difference instead could read a fils off the two
 * prices shown beside it (30.90 − 23.17 shown as 7.74, #57).
 */
export function formatPresentmentSaving(
  mrpPaise: number,
  pricePaise: number,
  p: MarketPricing | null,
): string {
  if (!p || !isCurrency(p.currency) || isRupeePricing(p)) {
    return formatMoney(mrpPaise - pricePaise, 'INR')
  }
  return formatMoney(presentmentMinor(mrpPaise, p) - presentmentMinor(pricePaise, p), p.currency)
}
