/** SOURCE OF TRUTH: MarketPricing, presentmentMinor, marketPricing
 * WHAT:  A rupee price in a market's currency, Shopify Markets style: rupees × the market's
 *        rate (its fixed rate, else the day's reference rate) × its price adjustment, then its
 *        rounding, as whole minor units of that currency (cents, fils). Pure, browser safe.
 * WHY:   Prices, reports and GST stay in paise; only what a shopper abroad sees (and, from
 *        M2, pays) is converted, by one rule on the storefront, cart and checkout.
 */
import { CURRENCIES, isCurrency } from '@commerce/money'

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
}

/** Rupees as rupees: the primary market, or a market whose rate is not known yet. */
export const RUPEE_PRICING: MarketPricing = {
  currency: 'INR',
  rate: 1,
  adjustmentBp: 0,
  rounding: 'none',
}

/** Decimal places of a currency's minor unit (ISO 4217); 2 when this package does not know it. */
function minorDigits(currency: string): number {
  return isCurrency(currency) ? CURRENCIES[currency].minorUnit : 2
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
export function presentmentMinor(paise: number, p: MarketPricing): number {
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

type MarketPricingInput = {
  currency: string
  /** `market.manual_rate`: the store's own units per rupee, or null. */
  manualRate: number | string | null
  priceAdjustmentBp: number
  rounding: MarketRoundingRule
}

/**
 * A market's pricing from its row and the latest reference rate for its currency. Null when
 * the market has no fixed rate and no reference rate is known yet (callers show rupees).
 */
export function marketPricing(
  m: MarketPricingInput,
  referenceRate: number | null,
): MarketPricing | null {
  const manual = m.manualRate === null ? null : Number(m.manualRate)
  // A rupee market converts at 1 (the primary market never has an adjustment: it keeps its prices).
  const rate = m.currency === 'INR' ? 1 : manual !== null && manual > 0 ? manual : referenceRate
  if (rate === null || !(rate > 0)) return null
  return {
    currency: m.currency,
    rate,
    adjustmentBp: m.priceAdjustmentBp,
    rounding: m.rounding,
  }
}
