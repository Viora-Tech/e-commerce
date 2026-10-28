/** SOURCE OF TRUTH: marketPricing
 * WHAT:  A market's pricing from its row and the latest reference rate. The conversion itself
 *        (`MarketPricing`, `presentmentMinor`, `presentmentCents`, `formatPresentment`) lives in
 *        @commerce/money, so the theme blocks (which do not depend on core) price with it too.
 * WHY:   Prices, reports and GST stay in paise; only what a shopper abroad sees is converted.
 */
import type { MarketPricing, MarketRoundingRule } from '@commerce/money'

export {
  formatPresentment,
  type MarketPricing,
  type MarketRoundingRule,
  presentmentCents,
  presentmentMinor,
  RUPEE_PRICING,
} from '@commerce/money'

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
