/** SOURCE OF TRUTH: checkout payment methods tests — WHAT the method row guarantees / WHY checkout order and COD rules don't drift */
import { describe, expect, it } from 'vitest'
import {
  checkoutMethodsOf,
  DEFAULT_CHECKOUT_METHODS,
  enabledForMethods,
  onlineMethodsOn,
  primaryGatewayOf,
} from './methods'

describe('checkoutMethodsOf', () => {
  it('gives an old store the defaults, with COD and EMI following its earlier switches', () => {
    const rows = checkoutMethodsOf({
      enabled: ['razorpay', 'cod'],
      providers: { razorpay: { enableEmi: 'true' } },
    })
    expect(rows.find((m) => m.id === 'cod')?.on).toBe(true)
    expect(rows.find((m) => m.id === 'emi')?.on).toBe(true)
    expect(rows.find((m) => m.id === 'wallet')?.on).toBe(false)
  })

  it('keeps the saved order, drops repeats and appends missing methods switched off', () => {
    const rows = checkoutMethodsOf({
      enabled: [],
      methods: [
        { id: 'cod', on: true },
        { id: 'upi', on: true },
        { id: 'cod', on: false },
      ],
    })
    expect(rows.map((m) => m.id)).toEqual(['cod', 'upi', 'card', 'netbanking', 'wallet', 'emi'])
    expect(rows.filter((m) => m.on).map((m) => m.id)).toEqual(['cod', 'upi'])
  })
})

describe('onlineMethodsOn', () => {
  it('lists online methods that are on, in order, never COD', () => {
    expect(onlineMethodsOn(DEFAULT_CHECKOUT_METHODS)).toEqual(['upi', 'card', 'netbanking'])
    expect(onlineMethodsOn([{ id: 'cod', on: true }])).toEqual([])
  })
})

describe('enabledForMethods', () => {
  it('puts the gateway where the first online method is and COD where COD is', () => {
    const rows = checkoutMethodsOf({
      enabled: [],
      methods: [
        { id: 'cod', on: true },
        { id: 'card', on: true },
      ],
    })
    expect(enabledForMethods(['razorpay', 'manual'], rows, 'razorpay')).toEqual([
      'cod',
      'razorpay',
      'manual',
    ])
  })

  it('drops the gateway when every online method is off, and COD when it is off', () => {
    const rows = checkoutMethodsOf({ enabled: [], methods: [{ id: 'upi', on: false }] })
    expect(enabledForMethods(['razorpay', 'cod', 'manual'], rows, 'razorpay')).toEqual(['manual'])
  })
})

describe('primaryGatewayOf', () => {
  it('prefers the enabled gateway, then one with saved keys', () => {
    expect(primaryGatewayOf({ enabled: ['cod', 'cashfree'] })).toBe('cashfree')
    expect(
      primaryGatewayOf({ enabled: ['cod'], providers: { razorpay: { keyId: 'rzp_test_1' } } }),
    ).toBe('razorpay')
    expect(primaryGatewayOf({ enabled: ['cod'] })).toBeNull()
  })
})
