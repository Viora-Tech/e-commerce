import { describe, expect, it } from 'vitest'
import {
  applyEmiSettingsPatch,
  defaultEmiWidgetSettings,
  type EmiPaymentsView,
  EmiWidgetSettingsPatchSchema,
  emiOfferFor,
  emiOffersConfig,
  emiReadiness,
  parseEmiWidgetSettings,
  razorpayKeyIdOf,
} from '../src/offer'

const emiOn = [
  { id: 'upi', on: true },
  { id: 'emi', on: true },
] as const

const razorpayWithEmi: EmiPaymentsView = {
  enabled: ['razorpay', 'cod'],
  methods: [...emiOn],
  providers: { razorpay: { keyId: 'rzp_test_abc123' } },
}

describe('settings', () => {
  it('defaults: on, Razorpay, from ₹1,000', () => {
    expect(defaultEmiWidgetSettings).toEqual({
      enabled: true,
      gateway: 'razorpay',
      minPricePaise: 100_000,
    })
  })

  it('falls back to defaults on garbage', () => {
    expect(parseEmiWidgetSettings(null)).toEqual(defaultEmiWidgetSettings)
    expect(parseEmiWidgetSettings({ gateway: 'paypal' })).toEqual(defaultEmiWidgetSettings)
    expect(parseEmiWidgetSettings({ minPricePaise: -5 })).toEqual(defaultEmiWidgetSettings)
  })

  it('a partial save keeps what was saved before (no defaults leak in)', () => {
    const saved = { enabled: false, gateway: 'cashfree' as const, minPricePaise: 500_000 }
    const patch = EmiWidgetSettingsPatchSchema.parse({ minPricePaise: 200_000 })
    expect(patch).toEqual({ minPricePaise: 200_000 })
    expect(applyEmiSettingsPatch(saved, patch)).toEqual({ ...saved, minPricePaise: 200_000 })
    expect(applyEmiSettingsPatch(saved, { enabled: undefined })).toEqual(saved)
  })

  it('rejects a negative or fractional minimum', () => {
    expect(EmiWidgetSettingsPatchSchema.safeParse({ minPricePaise: -1 }).success).toBe(false)
    expect(EmiWidgetSettingsPatchSchema.safeParse({ minPricePaise: 1.5 }).success).toBe(false)
  })
})

describe('readiness', () => {
  it('ready when on, gateway enabled and EMI on at checkout', () => {
    expect(emiReadiness(defaultEmiWidgetSettings, razorpayWithEmi)).toBe('ready')
  })

  it('off wins over everything else', () => {
    expect(emiReadiness({ ...defaultEmiWidgetSettings, enabled: false }, razorpayWithEmi)).toBe(
      'off',
    )
  })

  it('needs the chosen gateway turned on', () => {
    const cashfree = { ...defaultEmiWidgetSettings, gateway: 'cashfree' as const }
    expect(emiReadiness(cashfree, razorpayWithEmi)).toBe('gateway-not-set-up')
  })

  it('needs EMI on at checkout', () => {
    const payments = { ...razorpayWithEmi, methods: [{ id: 'emi' as const, on: false }] }
    expect(emiReadiness(defaultEmiWidgetSettings, payments)).toBe('emi-off-at-checkout')
  })

  it('honours the older Razorpay EMI switch on stores without a method row', () => {
    const legacy: EmiPaymentsView = {
      enabled: ['razorpay'],
      providers: { razorpay: { keyId: 'rzp_live_x', enableEmi: 'true' } },
    }
    expect(emiReadiness(defaultEmiWidgetSettings, legacy)).toBe('ready')
    const off = { ...legacy, providers: { razorpay: { keyId: 'rzp_live_x' } } }
    expect(emiReadiness(defaultEmiWidgetSettings, off)).toBe('emi-off-at-checkout')
  })
})

describe('Razorpay key id for the official widget', () => {
  it('uses the public key id only for Razorpay', () => {
    expect(razorpayKeyIdOf(defaultEmiWidgetSettings, razorpayWithEmi)).toBe('rzp_test_abc123')
    const cashfree = { ...defaultEmiWidgetSettings, gateway: 'cashfree' as const }
    expect(razorpayKeyIdOf(cashfree, razorpayWithEmi)).toBeNull()
  })

  it('ignores a missing or malformed key id', () => {
    const noKey = { ...razorpayWithEmi, providers: {} }
    expect(razorpayKeyIdOf(defaultEmiWidgetSettings, noKey)).toBeNull()
    const bad = { ...razorpayWithEmi, providers: { razorpay: { keyId: 'secret' } } }
    expect(razorpayKeyIdOf(defaultEmiWidgetSettings, bad)).toBeNull()
  })

  it('never exposes anything but the key id', () => {
    const withSecret = {
      ...razorpayWithEmi,
      providers: { razorpay: { keyId: 'rzp_test_abc123', keySecret: 'enc:xyz' } },
    }
    expect(JSON.stringify(emiOffersConfig(defaultEmiWidgetSettings, withSecret))).not.toContain(
      'enc:xyz',
    )
  })
})

describe('offer for a price', () => {
  const config = emiOffersConfig(defaultEmiWidgetSettings, razorpayWithEmi)

  it('is null when the store is not ready', () => {
    expect(emiOffersConfig({ ...defaultEmiWidgetSettings, enabled: false }, razorpayWithEmi)).toBe(
      null,
    )
    expect(emiOfferFor(null, 1_200_000)).toBeNull()
  })

  it('is null below the minimum price, and for zero', () => {
    expect(emiOfferFor(config, 99_999)).toBeNull()
    expect(emiOfferFor({ minPricePaise: 0, razorpayKeyId: null }, 0)).toBeNull()
  })

  it('works out the lowest monthly figure, rounded up', () => {
    expect(emiOfferFor(config, 1_200_000)).toEqual({
      amountPaise: 1_200_000,
      monthlyPaise: 100_000,
      razorpayKeyId: 'rzp_test_abc123',
    })
    expect(emiOfferFor(config, 100_001)?.monthlyPaise).toBe(8_334)
  })
})
