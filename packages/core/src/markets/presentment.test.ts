/** SOURCE OF TRUTH: presentment tests — WHAT: rate × adjustment then rounding, per currency's decimals, and which rate a market uses / WHY: every price a shopper abroad sees goes through `presentmentMinor` */
import { describe, expect, it } from 'vitest'
import { type MarketPricing, marketPricing, presentmentMinor, RUPEE_PRICING } from './presentment'

const usd = (p: Partial<MarketPricing> = {}): MarketPricing => ({
  currency: 'USD',
  rate: 0.012,
  adjustmentBp: 0,
  rounding: 'none',
  ...p,
})

describe('presentmentMinor', () => {
  it('leaves rupees as they are', () => {
    expect(presentmentMinor(64_900, RUPEE_PRICING)).toBe(64_900)
  })

  it('converts to whole cents at the rate', () => {
    // ₹649 × 0.012 = $7.788 → 779 cents
    expect(presentmentMinor(64_900, usd())).toBe(779)
  })

  it('applies the adjustment before rounding', () => {
    // ₹649 × 0.012 × 1.10 = $8.5668
    expect(presentmentMinor(64_900, usd({ adjustmentBp: 1000 }))).toBe(857)
    expect(presentmentMinor(64_900, usd({ adjustmentBp: 1000, rounding: 'whole' }))).toBe(900)
    expect(presentmentMinor(64_900, usd({ adjustmentBp: 1000, rounding: 'x99' }))).toBe(899)
  })

  it('rounds .99 up to the next .99, even from a whole amount', () => {
    // ₹1,000 × 0.014 = $14.00 → $14.99
    expect(presentmentMinor(100_000, usd({ rate: 0.014, rounding: 'x99' }))).toBe(1499)
    // $14.27 → $14.00 with whole
    expect(presentmentMinor(101_929, usd({ rate: 0.014, rounding: 'whole' }))).toBe(1400)
  })

  it('uses the currency’s own decimals: three for dinars, none for yen', () => {
    // ₹1,000 × 0.00367 KWD = 3.670 → 3670 fils; .99 → 3.990
    expect(presentmentMinor(100_000, { ...usd({ rate: 0.00367 }), currency: 'KWD' })).toBe(3670)
    expect(
      presentmentMinor(100_000, { ...usd({ rate: 0.00367, rounding: 'x99' }), currency: 'KWD' }),
    ).toBe(3990)
    // ₹1,000 × 1.79 = ¥1,790; .99 has no meaning without decimals: the next whole yen
    expect(presentmentMinor(100_000, { ...usd({ rate: 1.7905 }), currency: 'JPY' })).toBe(1791)
    expect(
      presentmentMinor(100_000, { ...usd({ rate: 1.7905, rounding: 'x99' }), currency: 'JPY' }),
    ).toBe(1791)
  })

  it('keeps the sign of a discount and maps zero to zero', () => {
    expect(presentmentMinor(-10_000, usd())).toBe(-120)
    expect(presentmentMinor(0, usd({ rounding: 'x99' }))).toBe(0)
  })
})

describe('marketPricing', () => {
  const gulf = {
    currency: 'AED',
    manualRate: null,
    priceAdjustmentBp: 500,
    rounding: 'whole' as const,
  }

  it('uses the reference rate when the market has no fixed rate', () => {
    expect(marketPricing(gulf, 0.0441)).toEqual({
      currency: 'AED',
      rate: 0.0441,
      adjustmentBp: 500,
      rounding: 'whole',
    })
  })

  it('prefers the market’s fixed rate', () => {
    expect(marketPricing({ ...gulf, manualRate: '0.04500000' }, 0.0441)?.rate).toBe(0.045)
  })

  it('has no pricing without any rate, so the shopper sees rupees', () => {
    expect(marketPricing(gulf, null)).toBeNull()
  })

  it('converts a rupee market at 1', () => {
    expect(marketPricing({ ...gulf, currency: 'INR', priceAdjustmentBp: 0 }, null)).toEqual({
      currency: 'INR',
      rate: 1,
      adjustmentBp: 0,
      rounding: 'whole',
    })
  })
})
