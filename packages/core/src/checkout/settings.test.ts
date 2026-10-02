/** SOURCE OF TRUTH: checkout settings tests — defaults, PIN code lists, COD rules, minimum order, contact and GSTIN checks, and the server-side rule check placeOrder runs */
import { describe, expect, it } from 'vitest'
import { CheckoutRuleViolation } from '../errors'
import {
  CheckoutSettingsSchema,
  checkCheckoutRules,
  checkoutPincode,
  checkoutRuleSubtotalPaise,
  codDecision,
  defaultCheckoutSettings,
  e164IndianMobile,
  minimumOrderShortfall,
  parseCheckoutSettings,
  parsePincodeList,
  validateCheckoutContact,
} from './settings'

// Valid GSTINs: the 15th character is the checksum over the first 14.
const GSTIN = '27AAPFU0939F1ZV'
const GSTIN_TYPO = '27AAPFU0939F1ZW'

const settings = (over: Parameters<typeof CheckoutSettingsSchema.parse>[0] = {}) =>
  CheckoutSettingsSchema.parse(over)

const checkout = {
  email: 'asha@example.com',
  phone: '+91 98765 43210',
  name: 'Asha',
  address: { line1: '12 MG Road', city: 'Gurugram', stateCode: 'HR', pincode: '122001' },
}

describe('checkout settings', () => {
  it('defaults to email required, PIN code first, no GSTIN, notes, minimum or COD limits', () => {
    expect(defaultCheckoutSettings).toEqual({
      email: 'required',
      pincodeFirst: true,
      gstin: false,
      orderNotes: false,
      minimumOrderPaise: 0,
      cod: { maxOrderPaise: 0, blockedPincodes: [], confirmOnWhatsApp: false },
      branding: CheckoutSettingsSchema.shape.branding.parse({}),
    })
  })

  it('reads the checkout key of store preferences and falls back on garbage', () => {
    expect(parseCheckoutSettings({ checkout: { email: 'optional' } }).email).toBe('optional')
    expect(parseCheckoutSettings({ checkout: { email: 'sometimes' } })).toEqual(
      defaultCheckoutSettings,
    )
    expect(parseCheckoutSettings(null)).toEqual(defaultCheckoutSettings)
  })

  it('dedupes and sorts blocked PIN codes and rejects bad ones', () => {
    expect(settings({ cod: { blockedPincodes: ['560001', '110001', '560001'] } }).cod).toEqual(
      expect.objectContaining({ blockedPincodes: ['110001', '560001'] }),
    )
    expect(() => settings({ cod: { blockedPincodes: ['012345'] } })).toThrow()
  })
})

describe('parsePincodeList', () => {
  it('reads pasted lists with any separator', () => {
    expect(parsePincodeList('110001, 560001\n400001;400001\t122001')).toEqual({
      pincodes: ['110001', '122001', '400001', '560001'],
      invalid: [],
    })
  })

  it('reads a CSV with a header and extra columns, reporting what is not a PIN code', () => {
    const csv = 'pincode,area\n"110001",Connaught Place\n560001,Bengaluru\n12345,Typo\n'
    const r = parsePincodeList(csv)
    expect(r.pincodes).toEqual(['110001', '560001'])
    expect(r.invalid).toEqual(['12345'])
  })
})

describe('COD rules', () => {
  const rules = settings({ cod: { maxOrderPaise: 500_000, blockedPincodes: ['110001'] } }).cod

  it('blocks listed PIN codes', () => {
    expect(codDecision(rules, { pincode: '110001', orderValuePaise: 100 })).toEqual({
      allowed: false,
      reason: 'blocked_pincode',
    })
  })

  it('blocks a listed PIN code however it is written', () => {
    for (const pincode of ['110-001', '110 001', ' 110001 ']) {
      expect(codDecision(rules, { pincode, orderValuePaise: 100 }), pincode).toMatchObject({
        allowed: false,
      })
    }
  })

  it('normalises the checkout PIN code, and refuses one that is not six digits', () => {
    expect(checkoutPincode('110-001')).toBe('110001')
    expect(checkoutPincode('11O001')).toBeNull()
    expect(checkoutPincode('011001')).toBeNull()
    expect(checkoutPincode(undefined)).toBeNull()
  })

  it('blocks orders over the limit, and allows one exactly at it', () => {
    expect(codDecision(rules, { pincode: '560001', orderValuePaise: 500_001 })).toEqual({
      allowed: false,
      reason: 'over_limit',
      limitPaise: 500_000,
    })
    expect(codDecision(rules, { pincode: '560001', orderValuePaise: 500_000 })).toEqual({
      allowed: true,
    })
  })

  it('has no limit at 0', () => {
    expect(
      codDecision(settings().cod, { pincode: '560001', orderValuePaise: 99_999_999 }).allowed,
    ).toBe(true)
  })
})

describe('minimum order', () => {
  it('returns what is missing, or 0', () => {
    expect(minimumOrderShortfall({ minimumOrderPaise: 50_000 }, 30_000)).toBe(20_000)
    expect(minimumOrderShortfall({ minimumOrderPaise: 50_000 }, 50_000)).toBe(0)
    expect(minimumOrderShortfall({ minimumOrderPaise: 0 }, 1)).toBe(0)
  })
})

describe('validateCheckoutContact', () => {
  it('normalises an Indian mobile number and lower-cases the email', () => {
    const r = validateCheckoutContact(settings(), {
      email: ' Asha@Example.com ',
      phone: '+91 98765-43210',
    })
    expect(r).toEqual({
      ok: true,
      value: {
        email: 'asha@example.com',
        phone: '9876543210',
        gstin: null,
        businessName: null,
        note: null,
      },
    })
    expect(e164IndianMobile('098765 43210')).toBe('+919876543210')
    expect(e164IndianMobile('12345')).toBeNull()
  })

  it('requires email unless the store made it optional', () => {
    expect(validateCheckoutContact(settings(), { email: '', phone: '9876543210' })).toEqual({
      ok: false,
      errors: { email: 'Enter your email address' },
    })
    const optional = validateCheckoutContact(settings({ email: 'optional' }), {
      email: '',
      phone: '9876543210',
    })
    expect(optional.ok && optional.value.email).toBeNull()
  })

  it('rejects numbers that are not Indian mobiles', () => {
    const r = validateCheckoutContact(settings(), { email: 'a@b.in', phone: '0123456789' })
    expect(r.ok).toBe(false)
    expect(!r.ok && r.errors.phone).toMatch(/10 digit/)
  })

  it('checks the GSTIN with the existing checksum when the field is on', () => {
    const on = settings({ gstin: true })
    const good = validateCheckoutContact(on, {
      email: 'a@b.in',
      phone: '9876543210',
      gstin: GSTIN.toLowerCase(),
      businessName: ' Asha Traders ',
    })
    expect(good.ok && good.value).toEqual(
      expect.objectContaining({ gstin: GSTIN, businessName: 'Asha Traders' }),
    )
    const typo = validateCheckoutContact(on, {
      email: 'a@b.in',
      phone: '9876543210',
      gstin: GSTIN_TYPO,
    })
    expect(!typo.ok && typo.errors.gstin).toMatch(/typo/)
    const state = validateCheckoutContact(on, {
      email: 'a@b.in',
      phone: '9876543210',
      gstin: `99${GSTIN.slice(2)}`,
    })
    expect(!state.ok && state.errors.gstin).toMatch(/state code/)
  })

  it('drops the GSTIN and note when the store turned those fields off', () => {
    const r = validateCheckoutContact(settings(), {
      email: 'a@b.in',
      phone: '9876543210',
      gstin: GSTIN_TYPO,
      note: 'Leave at the gate',
    })
    expect(r.ok && r.value).toEqual(expect.objectContaining({ gstin: null, note: null }))
  })

  it('keeps a note when notes are on and limits its length', () => {
    const on = settings({ orderNotes: true })
    const r = validateCheckoutContact(on, { email: 'a@b.in', phone: '9876543210', note: ' Gift ' })
    expect(r.ok && r.value.note).toBe('Gift')
    const long = validateCheckoutContact(on, {
      email: 'a@b.in',
      phone: '9876543210',
      note: 'x'.repeat(501),
    })
    expect(long.ok).toBe(false)
  })
})

describe('checkoutRuleSubtotalPaise (D-07)', () => {
  const shoes = { giftCard: false, quantity: 2, unitPricePaise: 40_000 }
  const card = { giftCard: true, quantity: 1, unitPricePaise: 500_000 }

  it('leaves gift-card lines out', () => {
    expect(checkoutRuleSubtotalPaise([shoes, card], 0)).toBe(80_000)
    expect(checkoutRuleSubtotalPaise([card], 0)).toBe(0)
  })

  it('takes the whole discount off the goods, never below zero', () => {
    expect(checkoutRuleSubtotalPaise([shoes, card], 10_000)).toBe(70_000)
    expect(checkoutRuleSubtotalPaise([shoes, card], 200_000)).toBe(0)
  })

  it('a gift card neither reaches the minimum nor trips the COD limit', () => {
    const rules = settings({
      minimumOrderPaise: 100_000,
      cod: { maxOrderPaise: 150_000, blockedPincodes: [] },
    })
    const order = {
      checkout,
      paymentProviderId: 'cod',
      giftCardsOnly: false,
      shippingPaise: 5_000,
    }
    // ₹800 of shoes plus a ₹5,000 card: still ₹200 short of a ₹1,000 minimum.
    expect(() =>
      checkCheckoutRules(rules, {
        ...order,
        ruleSubtotalPaise: checkoutRuleSubtotalPaise([shoes, card], 0),
      }),
    ).toThrow(expect.objectContaining({ rule: 'minimum_order', amountPaise: 20_000 }))
    // ₹1,200 of shoes plus the card: COD stays open under a ₹1,500 limit.
    const more = { ...shoes, quantity: 3 }
    expect(() =>
      checkCheckoutRules(rules, {
        ...order,
        ruleSubtotalPaise: checkoutRuleSubtotalPaise([more, card], 0),
      }),
    ).not.toThrow()
  })
})

describe('checkCheckoutRules (placeOrder, server side)', () => {
  const base = {
    checkout,
    paymentProviderId: 'razorpay',
    giftCardsOnly: false,
    ruleSubtotalPaise: 100_000,
    shippingPaise: 5_000,
  }

  it('returns the cleaned contact', () => {
    expect(checkCheckoutRules(settings(), base)?.phone).toBe('9876543210')
  })

  it('refuses a bad contact field whatever the client sent', () => {
    const run = () =>
      checkCheckoutRules(settings({ gstin: true }), {
        ...base,
        checkout: { ...checkout, gstin: GSTIN_TYPO },
      })
    expect(run).toThrow(CheckoutRuleViolation)
    try {
      run()
    } catch (e) {
      expect((e as CheckoutRuleViolation).rule).toBe('contact')
      expect((e as CheckoutRuleViolation).fields.gstin).toMatch(/typo/)
    }
  })

  it('enforces the minimum order on the discounted subtotal, except for gift cards', () => {
    const min = settings({ minimumOrderPaise: 150_000 })
    try {
      checkCheckoutRules(min, base)
      expect.unreachable()
    } catch (e) {
      expect((e as CheckoutRuleViolation).rule).toBe('minimum_order')
      expect((e as CheckoutRuleViolation).amountPaise).toBe(50_000)
    }
    expect(() => checkCheckoutRules(min, { ...base, giftCardsOnly: true })).not.toThrow()
  })

  it('applies COD limits only to cash on delivery, counting shipping', () => {
    const cod = settings({ cod: { maxOrderPaise: 104_999, blockedPincodes: ['560001'] } })
    expect(() => checkCheckoutRules(cod, base)).not.toThrow()
    try {
      checkCheckoutRules(cod, { ...base, paymentProviderId: 'cod' })
      expect.unreachable()
    } catch (e) {
      expect((e as CheckoutRuleViolation).rule).toBe('cod_over_limit')
    }
    try {
      checkCheckoutRules(cod, {
        ...base,
        paymentProviderId: 'cod',
        ruleSubtotalPaise: 1_000,
        checkout: { ...checkout, address: { ...checkout.address, pincode: '560001' } },
      })
      expect.unreachable()
    } catch (e) {
      expect((e as CheckoutRuleViolation).rule).toBe('cod_blocked_pincode')
    }
  })
})
