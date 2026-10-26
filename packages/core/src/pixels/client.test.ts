/** SOURCE OF TRUTH: Pixels rule tests — WHAT: event ids, the Purchase trigger per order event (incl. prepaid-paid / COD-delivered), the consent gate and skip reasons, and the _fbp/_fbc formats / WHY: the browser and server copies must agree, or Meta counts a sale twice or not at all */
import { describe, expect, it } from 'vitest'
import {
  addPaymentInfoEventId,
  addToCartEventId,
  browserSendsPurchase,
  fbcFromClick,
  fbclidOf,
  hasMarketingConsent,
  initiateCheckoutEventId,
  isMetaPixelId,
  isValidEventId,
  isValidFbc,
  isValidFbp,
  mintFbp,
  purchaseEventId,
  purchaseSkipReason,
  purchaseTriggerMatches,
} from './client'

const uuid = '0199a000-0000-7000-8000-000000000001'

describe('event ids', () => {
  it('derive Purchase, InitiateCheckout and AddToCart ids from records', () => {
    expect(purchaseEventId(uuid)).toBe(`ord_${uuid}`)
    expect(initiateCheckoutEventId(uuid)).toBe(`ic_${uuid}`)
    expect(addToCartEventId(uuid, 2)).toBe(`atc_${uuid}_2`)
    expect(addToCartEventId(uuid, 0)).toBe(`atc_${uuid}_1`)
    expect(addPaymentInfoEventId(uuid, 'cod')).toBe(`api_${uuid}_cod`)
    expect(addPaymentInfoEventId(uuid, 'Manual_UPI')).toBe(`api_${uuid}_manual-upi`)
  })

  it('accept only the shapes we mint', () => {
    expect(isValidEventId('Purchase', purchaseEventId(uuid))).toBe(true)
    expect(isValidEventId('Purchase', 'ord_<script>')).toBe(false)
    expect(isValidEventId('InitiateCheckout', initiateCheckoutEventId(uuid))).toBe(true)
    expect(isValidEventId('AddToCart', addToCartEventId(uuid, 3))).toBe(true)
    expect(isValidEventId('AddToCart', `atc_${uuid}`)).toBe(false)
    expect(isValidEventId('AddPaymentInfo', addPaymentInfoEventId(uuid, 'razorpay'))).toBe(true)
    expect(isValidEventId('AddPaymentInfo', `api_${uuid}_COD!`)).toBe(false)
    expect(isValidEventId('AddPaymentInfo', `ic_${uuid}`)).toBe(false)
    expect(isValidEventId('PageView', uuid)).toBe(true)
    expect(isValidEventId('ViewContent', 'hello')).toBe(false)
    expect(isValidEventId('PageView', 'x'.repeat(200))).toBe(false)
  })

  it('pixel ids are 10 to 20 digits', () => {
    expect(isMetaPixelId('1234567890')).toBe(true)
    expect(isMetaPixelId('123456789')).toBe(false)
    expect(isMetaPixelId('12345678901234567890a')).toBe(false)
  })
})

describe('purchase trigger', () => {
  it('each trigger fires on its own order event', () => {
    expect(purchaseTriggerMatches('placed', 'order.placed', 'cod')).toBe(true)
    expect(purchaseTriggerMatches('placed', 'order.paid', 'razorpay')).toBe(false)
    expect(purchaseTriggerMatches('paid', 'order.paid', 'razorpay')).toBe(true)
    expect(purchaseTriggerMatches('delivered', 'order.delivered', 'razorpay')).toBe(true)
    expect(purchaseTriggerMatches('delivered', 'order.placed', 'razorpay')).toBe(false)
  })

  it('paid_or_delivered: prepaid when paid, COD when delivered', () => {
    expect(purchaseTriggerMatches('paid_or_delivered', 'order.paid', 'razorpay')).toBe(true)
    expect(purchaseTriggerMatches('paid_or_delivered', 'order.delivered', 'razorpay')).toBe(false)
    expect(purchaseTriggerMatches('paid_or_delivered', 'order.delivered', 'cod')).toBe(true)
    expect(purchaseTriggerMatches('paid_or_delivered', 'order.paid', 'cod')).toBe(false)
    expect(purchaseTriggerMatches('paid_or_delivered', 'order.placed', 'cod')).toBe(false)
  })

  it('the browser sends Purchase only for "placed"', () => {
    expect(browserSendsPurchase('placed')).toBe(true)
    expect(browserSendsPurchase('paid')).toBe(false)
    expect(browserSendsPurchase('paid_or_delivered')).toBe(false)
  })
})

describe('consent gate and skips', () => {
  const now = new Date('2026-10-24T10:00:00Z')
  const consented = {
    consent: { marketing: true, analytics: false, version: 2, at: now.toISOString() },
  }
  const base = { isTest: false, importedFrom: null, tracking: consented, placedAt: now }

  it('needs marketing consent', () => {
    expect(hasMarketingConsent(consented)).toBe(true)
    expect(hasMarketingConsent({ consent: { ...consented.consent, marketing: false } })).toBe(false)
    expect(hasMarketingConsent({ fbp: 'fb.1.1.1' })).toBe(false)
    expect(hasMarketingConsent(null)).toBe(false)
  })

  it('skips test, imported, untracked, unconsented and too-old orders, in that order', () => {
    expect(purchaseSkipReason(base, now)).toBeNull()
    expect(purchaseSkipReason({ ...base, isTest: true }, now)).toBe('test_order')
    expect(purchaseSkipReason({ ...base, importedFrom: 'shopify' }, now)).toBe('imported')
    expect(purchaseSkipReason({ ...base, tracking: null }, now)).toBe('no_tracking')
    expect(purchaseSkipReason({ ...base, tracking: { fbp: 'x' } }, now)).toBe('no_consent')
    const eightDaysAgo = new Date(now.getTime() - 8 * 24 * 3600 * 1000)
    expect(purchaseSkipReason({ ...base, placedAt: eightDaysAgo }, now)).toBe('too_old')
    const sixDaysAgo = new Date(now.getTime() - 6 * 24 * 3600 * 1000)
    expect(purchaseSkipReason({ ...base, placedAt: sixDaysAgo }, now)).toBeNull()
  })
})

describe('first-party cookies', () => {
  const now = new Date('2026-10-24T10:00:00.123Z')

  it('mints _fbp as fb.1.<ms>.<10 digits>', () => {
    const fbp = mintFbp(now, 0.123456789)
    expect(fbp).toBe(`fb.1.${now.getTime()}.1234567890`)
    expect(isValidFbp(fbp)).toBe(true)
    expect(isValidFbp(mintFbp(now, 0))).toBe(true)
  })

  it('builds _fbc from a click id and refuses junk', () => {
    const fbc = fbcFromClick('IwAR2abc_DEF-9', now)
    expect(fbc).toBe(`fb.1.${now.getTime()}.IwAR2abc_DEF-9`)
    expect(isValidFbc(fbc)).toBe(true)
    expect(fbclidOf(fbc as string)).toBe('IwAR2abc_DEF-9')
    expect(fbcFromClick('<script>', now)).toBeNull()
    expect(fbcFromClick('', now)).toBeNull()
    expect(isValidFbc('fb.1.abc.x')).toBe(false)
  })
})
