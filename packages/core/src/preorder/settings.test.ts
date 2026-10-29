import { describe, expect, it } from 'vitest'
import { isLaunched, msUntilLaunch } from './launch'
import {
  PreorderSettingsInputSchema,
  type ProductPreorderRow,
  resolvePreorderSettings,
  resolveShipDate,
  validateDepositAgainstPrice,
  variantAllowsPreorder,
  withPreorderAllowed,
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
