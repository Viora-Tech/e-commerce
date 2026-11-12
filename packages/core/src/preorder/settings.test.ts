import { describe, expect, it } from 'vitest'
import { isLaunched, msUntilLaunch } from './launch'
import {
  nextVariantPreorderOverride,
  PreorderSettingsInputSchema,
  type ProductPreorderRow,
  resolvePreorderSettings,
  resolveShipDate,
  validateDepositAgainstPrice,
  variantAllowsPreorder,
  variantPreorderLimit,
  withPreorderAllowed,
  withPreorderLimit,
} from './settings'

const product: ProductPreorderRow = {
  preorderEnabled: true,
  preorderShipDate: null,
  preorderShipsInDays: 14,
  preorderLimit: 50,
  preorderButtonLabel: 'Pre-order',
  preorderPaymentMode: 'percentage',
  preorderDepositPaise: null,
  preorderDepositPercent: 25,
}

describe('resolvePreorderSettings', () => {
  it('uses the product settings with no override', () => {
    expect(resolvePreorderSettings(product)).toEqual({
      enabled: true,
      shipDate: null,
      shipsInDays: 14,
      limit: 50,
      buttonLabel: 'Pre-order',
      paymentMode: 'percentage',
      depositPaise: null,
      depositPercent: 25,
    })
  })

  it('merges a partial variant override onto the product settings', () => {
    const resolved = resolvePreorderSettings(product, { limit: 5, paymentMode: 'full' })
    expect(resolved.limit).toBe(5)
    expect(resolved.paymentMode).toBe('full')
    // untouched fields inherit
    expect(resolved.shipsInDays).toBe(14)
    expect(resolved.enabled).toBe(true)
  })

  it('an override can turn pre-order off for one variant', () => {
    expect(resolvePreorderSettings(product, { enabled: false }).enabled).toBe(false)
  })

  // #962: pre-order is per variant, the product's switch AND the variant's "Allow pre-order".
  it('a variant cannot turn pre-order on for a product that has it off', () => {
    const off = { ...product, preorderEnabled: false }
    expect(resolvePreorderSettings(off, { enabled: true }).enabled).toBe(false)
    expect(resolvePreorderSettings(off).enabled).toBe(false)
  })
})

describe("the variant's Allow pre-order switch", () => {
  it('is on unless the override turns it off', () => {
    expect(variantAllowsPreorder(null)).toBe(true)
    expect(variantAllowsPreorder({ limit: 3 })).toBe(true)
    expect(variantAllowsPreorder({ enabled: false })).toBe(false)
  })

  it('stores off as enabled: false and on as no override, keeping other keys', () => {
    expect(withPreorderAllowed(null, false)).toEqual({ enabled: false })
    expect(withPreorderAllowed({ enabled: false }, true)).toBeNull()
    expect(withPreorderAllowed({ enabled: false, limit: 3 }, true)).toEqual({ limit: 3 })
  })
})

describe('resolveShipDate', () => {
  it('prefers an absolute ship date over "ships in N days"', () => {
    const shipDate = new Date('2026-12-01T00:00:00Z')
    const settings = resolvePreorderSettings({ ...product, preorderShipDate: shipDate })
    expect(resolveShipDate(settings)).toEqual(shipDate)
  })

  it('computes from "ships in N days" when no absolute date is set', () => {
    const from = new Date('2026-01-01T00:00:00Z')
    const settings = resolvePreorderSettings(product)
    expect(resolveShipDate(settings, from)).toEqual(new Date('2026-01-15T00:00:00Z'))
  })

  it('null when neither is set', () => {
    const settings = resolvePreorderSettings({
      ...product,
      preorderShipDate: null,
      preorderShipsInDays: null,
    })
    expect(resolveShipDate(settings)).toBeNull()
  })
})

describe('validateDepositAgainstPrice', () => {
  it('waits for a price before comparing a fixed deposit (#913)', () => {
    expect(validateDepositAgainstPrice('fixed', 50000, null)).toBeNull()
    expect(validateDepositAgainstPrice('fixed', null, null)).toMatch(/needs an amount/)
  })

  it('rejects a fixed deposit equal to or above the price', () => {
    expect(validateDepositAgainstPrice('fixed', 50000, 50000)).toMatch(/less than/)
    expect(validateDepositAgainstPrice('fixed', 60000, 50000)).toMatch(/less than/)
  })

  it('accepts a fixed deposit below the price', () => {
    expect(validateDepositAgainstPrice('fixed', 10000, 50000)).toBeNull()
  })

  it('does not apply to full or percentage modes', () => {
    expect(validateDepositAgainstPrice('full', null, 50000)).toBeNull()
    expect(validateDepositAgainstPrice('percentage', null, 50000)).toBeNull()
  })
})

describe('PreorderSettingsInputSchema', () => {
  const base = {
    enabled: true,
    shipDate: null,
    shipsInDays: 10,
    limit: null,
    buttonLabel: 'Pre-order',
  }

  it('accepts a percentage mode with 1-99', () => {
    const result = PreorderSettingsInputSchema.safeParse({
      ...base,
      paymentMode: 'percentage',
      depositPaise: null,
      depositPercent: 50,
    })
    expect(result.success).toBe(true)
  })

  it('rejects a percentage outside 1-99', () => {
    expect(
      PreorderSettingsInputSchema.safeParse({
        ...base,
        paymentMode: 'percentage',
        depositPaise: null,
        depositPercent: 100,
      }).success,
    ).toBe(false)
    expect(
      PreorderSettingsInputSchema.safeParse({
        ...base,
        paymentMode: 'percentage',
        depositPaise: null,
        depositPercent: 0,
      }).success,
    ).toBe(false)
  })

  it('rejects fixed mode with no deposit amount', () => {
    expect(
      PreorderSettingsInputSchema.safeParse({
        ...base,
        paymentMode: 'fixed',
        depositPaise: null,
        depositPercent: null,
      }).success,
    ).toBe(false)
  })
})

describe('isLaunched / msUntilLaunch', () => {
  it('null launchAt is always launched', () => {
    expect(isLaunched(null)).toBe(true)
    expect(msUntilLaunch(null)).toBe(0)
  })

  it('before launch is not launched, and vice versa', () => {
    const now = new Date('2026-01-01T00:00:00Z')
    const future = new Date('2026-01-02T00:00:00Z')
    const past = new Date('2025-12-31T00:00:00Z')
    expect(isLaunched(future, now)).toBe(false)
    expect(isLaunched(past, now)).toBe(true)
    expect(isLaunched(now, now)).toBe(true)
  })

  it('msUntilLaunch counts down to zero, never negative', () => {
    const now = new Date('2026-01-01T00:00:00Z')
    const future = new Date('2026-01-01T00:00:10Z')
    expect(msUntilLaunch(future, now)).toBe(10_000)
    expect(msUntilLaunch(new Date('2025-01-01T00:00:00Z'), now)).toBe(0)
  })
})

describe("a variant's own pre-order limit", () => {
  it("wins over the product's limit; blank (null or left out) falls back to it", () => {
    expect(resolvePreorderSettings(product, { limit: 2 }).limit).toBe(2)
    expect(resolvePreorderSettings(product, { limit: null }).limit).toBe(50)
    expect(resolvePreorderSettings(product, { enabled: false }).limit).toBe(50)
    expect(resolvePreorderSettings(product, null).limit).toBe(50)
  })

  it('applies even when the product itself has no limit', () => {
    const unlimited = { ...product, preorderLimit: null }
    expect(resolvePreorderSettings(unlimited, { limit: 4 }).limit).toBe(4)
    expect(resolvePreorderSettings(unlimited, {}).limit).toBeNull()
  })

  it('is read back for the admin, null when the variant has none', () => {
    expect(variantPreorderLimit({ limit: 3, enabled: false })).toBe(3)
    expect(variantPreorderLimit({ enabled: false })).toBeNull()
    expect(variantPreorderLimit(null)).toBeNull()
  })

  it('sets and clears the limit without touching the other keys', () => {
    expect(withPreorderLimit({ enabled: false }, 5)).toEqual({ enabled: false, limit: 5 })
    expect(withPreorderLimit({ enabled: false, limit: 5 }, null)).toEqual({ enabled: false })
    expect(withPreorderLimit({ limit: 5 }, null)).toBeNull()
    expect(withPreorderLimit(null, 1)).toEqual({ limit: 1 })
  })
})

describe('the override a product save writes', () => {
  it('leaves the column alone when the save sends neither field', () => {
    expect(nextVariantPreorderOverride({ limit: 3 }, {})).toBeUndefined()
  })

  it('applies what the save sent on top of the stored override', () => {
    const stored = { enabled: false, limit: 3, buttonLabel: 'Reserve' }
    expect(nextVariantPreorderOverride(stored, { preorderAllowed: true })).toEqual({
      limit: 3,
      buttonLabel: 'Reserve',
    })
    expect(nextVariantPreorderOverride(stored, { preorderLimit: 8 })).toEqual({
      enabled: false,
      limit: 8,
      buttonLabel: 'Reserve',
    })
    expect(
      nextVariantPreorderOverride(stored, { preorderAllowed: true, preorderLimit: null }),
    ).toEqual({ buttonLabel: 'Reserve' })
    expect(
      nextVariantPreorderOverride({ limit: 3 }, { preorderAllowed: true, preorderLimit: null }),
    ).toBeNull()
  })

  it("builds a new variant's override from nothing", () => {
    expect(nextVariantPreorderOverride(null, { preorderAllowed: false, preorderLimit: 2 })).toEqual(
      { enabled: false, limit: 2 },
    )
    expect(nextVariantPreorderOverride(undefined, { preorderAllowed: true })).toBeNull()
  })
})
