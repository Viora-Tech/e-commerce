import { describe, expect, it } from 'vitest'
import {
  balanceToken,
  balanceUrl,
  orderViewToken,
  payPath,
  thankYouPath,
  thankYouUrl,
  verifyBalanceToken,
  verifyOrderViewToken,
} from './balance-link'
import { nextBalanceStep } from './balance-schedule'
import { balancePayBy, depositIsNonRefundable, parsePreorderStoreSettings } from './store-settings'

const DAY = 86_400_000
const t0 = new Date('2026-10-01T00:00:00Z')
const at = (days: number) => new Date(t0.getTime() + days * DAY)

describe('nextBalanceStep', () => {
  const s = parsePreorderStoreSettings({
    autoRequestDaysBeforeShip: 3,
    reminderDays: [6, 2],
    unpaidAction: 'cancel_refund',
    payWithinDays: 10,
  })

  it('requests ahead of the ship date only when automated and a date is known', () => {
    const o = { requestedAt: null, remindersSent: 0, shipDate: at(10) }
    expect(nextBalanceStep(s, o, at(6))).toBeNull()
    expect(nextBalanceStep(s, o, at(7))).toBe('request')
    expect(nextBalanceStep(s, { ...o, shipDate: null }, at(20))).toBeNull()
    const manual = parsePreorderStoreSettings({ autoRequestDaysBeforeShip: null })
    expect(nextBalanceStep(manual, o, at(20))).toBeNull()
  })

  it('reminds in order, at most twice, then applies the unpaid rule', () => {
    const o = { requestedAt: t0, shipDate: null }
    expect(nextBalanceStep(s, { ...o, remindersSent: 0 }, at(1))).toBeNull()
    expect(nextBalanceStep(s, { ...o, remindersSent: 0 }, at(2))).toBe('remind')
    expect(nextBalanceStep(s, { ...o, remindersSent: 1 }, at(5))).toBeNull()
    expect(nextBalanceStep(s, { ...o, remindersSent: 1 }, at(6))).toBe('remind')
    expect(nextBalanceStep(s, { ...o, remindersSent: 2 }, at(9))).toBeNull()
    expect(nextBalanceStep(s, { ...o, remindersSent: 2 }, at(10))).toBe('expire')
    const off = parsePreorderStoreSettings({ unpaidAction: 'none', reminderDays: [] })
    expect(nextBalanceStep(off, { ...o, remindersSent: 0 }, at(365))).toBeNull()
  })
})

describe('store settings', () => {
  it('defaults safely and sorts reminder days', () => {
    const d = parsePreorderStoreSettings(null)
    expect(d.unpaidAction).toBe('none')
    expect(d.autoRequestDaysBeforeShip).toBeNull()
    expect(parsePreorderStoreSettings({ reminderDays: [6, 3] }).reminderDays).toEqual([3, 6])
    expect(parsePreorderStoreSettings({ reminderDays: [1, 2, 3] }).unpaidAction).toBe('none')
  })

  it('knows when the deposit is non-refundable and the pay-by date', () => {
    const keep = parsePreorderStoreSettings({ unpaidAction: 'cancel_keep', payWithinDays: 7 })
    expect(depositIsNonRefundable(keep)).toBe(true)
    expect(balancePayBy(keep, t0)).toEqual(at(7))
    expect(balancePayBy(keep, null)).toBeNull()
    expect(balancePayBy(parsePreorderStoreSettings({}), t0)).toBeNull()
  })
})

describe('pay-balance link', () => {
  const secret = 'shh'

  it('round-trips, and refuses a tampered, foreign or expired token', () => {
    const token = balanceToken('order-1', secret, t0)
    expect(verifyBalanceToken(token, secret, at(1))).toEqual({ ok: true, orderId: 'order-1' })
    expect(verifyBalanceToken(token.replace('order-1', 'order-2'), secret, at(1)).ok).toBe(false)
    expect(verifyBalanceToken(token, 'other', at(1))).toEqual({ ok: false, reason: 'signature' })
    expect(verifyBalanceToken(token, secret, at(61))).toEqual({ ok: false, reason: 'expired' })
    expect(verifyBalanceToken('nope', secret)).toEqual({ ok: false, reason: 'malformed' })
    expect(balanceUrl('order-1', secret, 'https://shop.test/', t0)).toBe(
      `https://shop.test/checkout/balance/${token}`,
    )
  })
})

describe('order-view link (thank-you / pay IDOR guard)', () => {
  const secret = 'shh'

  it('round-trips for the order it was minted for, and refuses everything else', () => {
    const token = orderViewToken('order-1', secret, t0)
    // Right token, right order: ok.
    expect(verifyOrderViewToken(token, secret, at(1))).toEqual({ ok: true, orderId: 'order-1' })
    // Right token, checked against a different order id: the caller must
    // reject (this is the "another order's token" check the page does).
    const other = orderViewToken('order-2', secret, t0)
    expect(verifyOrderViewToken(other, secret, at(1))).not.toEqual(
      verifyOrderViewToken(token, secret, at(1)),
    )
    // Tampered order id in the token body: signature fails.
    expect(verifyOrderViewToken(token.replace('order-1', 'order-2'), secret, at(1)).ok).toBe(false)
    // Wrong secret: signature fails.
    expect(verifyOrderViewToken(token, 'other', at(1))).toEqual({ ok: false, reason: 'signature' })
    // Missing / malformed token: never confused with "valid".
    expect(verifyOrderViewToken('', secret)).toEqual({ ok: false, reason: 'malformed' })
    expect(verifyOrderViewToken('nope', secret)).toEqual({ ok: false, reason: 'malformed' })
    // A balance token must never work as an order-view token, and vice versa
    // (distinct purpose prefixes on the same HMAC helper).
    const balance = balanceToken('order-1', secret, t0)
    expect(verifyOrderViewToken(balance, secret, at(1)).ok).toBe(false)
    expect(verifyBalanceToken(token, secret, at(1)).ok).toBe(false)
  })

  it('builds the thank-you and pay paths/URLs with the token attached', () => {
    const token = orderViewToken('order-1', secret, t0)
    expect(thankYouPath(7, token)).toBe(`/checkout/thank-you/7?t=${token}`)
    expect(payPath(7, token)).toBe(`/checkout/pay/7?t=${token}`)
    expect(thankYouUrl('order-1', 7, secret, 'https://shop.test/', t0)).toBe(
      `https://shop.test/checkout/thank-you/7?t=${token}`,
    )
  })
})
