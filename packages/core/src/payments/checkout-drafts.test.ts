/** SOURCE OF TRUTH: tests for the checkout drafts switch — WHAT: `checkoutDraftsOn` (store switch, default, kill switch), `draftsForMethod`, `draftHoldMinutes` / WHY: these decide whether an unpaid checkout is a draft or a numbered order */
import { describe, expect, it } from 'vitest'
import {
  CHECKOUT_DRAFTS_DEFAULT,
  checkoutDraftsOn,
  draftHoldMinutes,
  draftsForMethod,
} from './checkout-drafts'
import { defaultPaymentSettings } from './settings'

describe('checkoutDraftsOn', () => {
  it('follows the store switch, then the platform default', () => {
    expect(checkoutDraftsOn({ unpaidAsDrafts: 'on' }, {})).toBe(true)
    expect(checkoutDraftsOn({ unpaidAsDrafts: 'off' }, {})).toBe(false)
    expect(checkoutDraftsOn({}, {})).toBe(CHECKOUT_DRAFTS_DEFAULT)
  })

  it('the kill switch turns it off for every store', () => {
    expect(checkoutDraftsOn({ unpaidAsDrafts: 'on' }, { CHECKOUT_DRAFTS: 'off' })).toBe(false)
    expect(checkoutDraftsOn({ unpaidAsDrafts: 'on' }, { CHECKOUT_DRAFTS: ' OFF ' })).toBe(false)
    expect(checkoutDraftsOn({ unpaidAsDrafts: 'on' }, { CHECKOUT_DRAFTS: 'on' })).toBe(true)
  })
})

describe('draftsForMethod', () => {
  it('drafts online and transfer checkouts, never cash on delivery or gift cards', () => {
    expect(draftsForMethod('razorpay')).toBe(true)
    expect(draftsForMethod('manual')).toBe(true)
    expect(draftsForMethod('cod')).toBe(false)
    expect(draftsForMethod('gift_card')).toBe(false)
    expect(draftsForMethod('store_credit')).toBe(false)
  })
})

describe('draftHoldMinutes', () => {
  it('holds online drafts for the unpaid window, transfers for the transfer window', () => {
    expect(draftHoldMinutes(defaultPaymentSettings, 'razorpay')).toBe(30)
    expect(
      draftHoldMinutes({ ...defaultPaymentSettings, expireUnpaidAfterMinutes: 0 }, 'razorpay'),
    ).toBe(30)
    expect(
      draftHoldMinutes({ ...defaultPaymentSettings, expireUnpaidAfterMinutes: 45 }, 'razorpay'),
    ).toBe(45)
    expect(draftHoldMinutes(defaultPaymentSettings, 'manual')).toBe(48 * 60)
    expect(draftHoldMinutes({ ...defaultPaymentSettings, manualAutoCancel: 'on' }, 'manual')).toBe(
      6 * 60,
    )
  })
})
