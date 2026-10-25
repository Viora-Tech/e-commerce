/** SOURCE OF TRUTH: RTO risk score and COD & RTO settings tests (pure) — the points per reason, the cap, prepaid halving, levels, address checks, settings parsing and partial prepaid */
import { describe, expect, it } from 'vitest'
import { type RiskInput, scoreRtoRisk } from './score'
import {
  CodRtoSettingsSchema,
  codPrepaidDuePaise,
  parseCodRtoSettings,
  wantsCodConfirmation,
} from './settings'

const T = { mediumAt: 30, highAt: 60 }
const defaultCodRtoSettings = parseCodRtoSettings({})

const base: RiskInput = {
  pincode: { finished: 0, rto: 0 },
  shopper: { orders: 3, cancelled: 0, delivered: 1, rto: 0 },
  address: { line1: 'Flat 12, Shanti Apartments', line2: 'MG Road' },
  orderValuePaise: 100_000,
  paymentMethod: 'cod',
}

describe('scoreRtoRisk', () => {
  it('scores a returning customer with a good address and a quiet PIN code at 0', () => {
    expect(scoreRtoRisk(base, T)).toEqual({ score: 0, level: 'low', factors: [] })
  })

  it('adds the PIN code rate only after enough finished parcels', () => {
    const few = scoreRtoRisk({ ...base, pincode: { finished: 3, rto: 2 } }, T)
    expect(few.factors).toEqual([{ code: 'pincode_rto_few', points: 10 }])
    const high = scoreRtoRisk({ ...base, pincode: { finished: 10, rto: 4 } }, T)
    expect(high.factors[0]).toEqual({ code: 'pincode_rto_high', points: 35 })
    const some = scoreRtoRisk({ ...base, pincode: { finished: 10, rto: 2 } }, T)
    expect(some.score).toBe(20)
    const low = scoreRtoRisk({ ...base, pincode: { finished: 20, rto: 1 } }, T)
    expect(low.score).toBe(0)
  })

  it('weighs the shopper’s history: RTOs, cancellations, deliveries, a first order', () => {
    expect(scoreRtoRisk({ ...base, shopper: { ...base.shopper, rto: 1 } }, T).score).toBe(30)
    expect(scoreRtoRisk({ ...base, shopper: { ...base.shopper, rto: 3 } }, T).score).toBe(45)
    expect(scoreRtoRisk({ ...base, shopper: { ...base.shopper, cancelled: 2 } }, T).score).toBe(10)
    expect(
      scoreRtoRisk({ ...base, shopper: { orders: 0, cancelled: 0, delivered: 0, rto: 0 } }, T)
        .factors,
    ).toEqual([{ code: 'first_order', points: 10 }])
    // A trusted customer offsets other points, never below 0.
    const trusted = scoreRtoRisk(
      { ...base, shopper: { orders: 4, cancelled: 0, delivered: 4, rto: 0 } },
      T,
    )
    expect(trusted.score).toBe(0)
    expect(trusted.factors).toEqual([{ code: 'shopper_delivered', points: -15 }])
  })

  it('flags short addresses and addresses without a number, and big orders', () => {
    const codes = (line1: string) =>
      scoreRtoRisk({ ...base, address: { line1, line2: null } }, T).factors.map((f) => f.code)
    expect(codes('Near temple')).toEqual(['address_no_number', 'address_short'])
    expect(codes('House 4')).toEqual(['address_short'])
    expect(codes('Behind the big banyan tree, Old Market')).toEqual(['address_no_number'])
    expect(scoreRtoRisk({ ...base, orderValuePaise: 600_000 }, T).score).toBe(10)
    expect(scoreRtoRisk({ ...base, orderValuePaise: 1_200_000 }, T).score).toBe(15)
  })

  it('caps at 100, halves prepaid orders and lists the biggest reasons first', () => {
    const worst: RiskInput = {
      pincode: { finished: 10, rto: 5 },
      shopper: { orders: 5, cancelled: 3, delivered: 0, rto: 2 },
      address: { line1: 'Near temple' },
      orderValuePaise: 2_000_000,
      paymentMethod: 'cod',
    }
    const cod = scoreRtoRisk(worst, T)
    expect(cod.score).toBe(100)
    expect(cod.level).toBe('high')
    expect(cod.factors[0]?.code).toBe('shopper_rto_repeat')
    const prepaid = scoreRtoRisk({ ...worst, paymentMethod: 'razorpay' }, T)
    expect(prepaid.score).toBe(50)
    expect(prepaid.level).toBe('medium')
    expect(prepaid.factors).toContainEqual({ code: 'prepaid', points: -50 })
  })

  it('puts a score in its level by the store’s thresholds', () => {
    const level = (rto: number, t = T) =>
      scoreRtoRisk({ ...base, shopper: { ...base.shopper, rto } }, t).level
    expect(level(0)).toBe('low')
    expect(level(1)).toBe('medium')
    expect(level(2, { mediumAt: 20, highAt: 40 })).toBe('high')
  })
})

describe('COD & RTO settings', () => {
  it('falls back to the defaults and refuses a high threshold under the medium one', () => {
    expect(parseCodRtoSettings('nonsense')).toEqual(defaultCodRtoSettings)
    expect(defaultCodRtoSettings.verification.autoCancel).toBe(false)
    expect(CodRtoSettingsSchema.safeParse({ risk: { mediumAt: 50, highAt: 40 } }).success).toBe(
      false,
    )
  })

  it('works out the part of a big COD order to pay first, rounded up to a rupee', () => {
    const rules = {
      ...defaultCodRtoSettings.rules,
      partialPrepaid: { enabled: true, abovePaise: 500_000, percent: 20 },
    }
    expect(codPrepaidDuePaise(rules, 400_000)).toBe(0)
    expect(codPrepaidDuePaise(rules, 600_050)).toBe(120_100)
    expect(codPrepaidDuePaise(defaultCodRtoSettings.rules, 900_000)).toBe(0)
  })

  it('asks for confirmation on COD only, and only for risky orders when set so', () => {
    const s = defaultCodRtoSettings
    expect(wantsCodConfirmation(s, { paymentMethod: 'cod', level: 'low' })).toBe(true)
    expect(wantsCodConfirmation(s, { paymentMethod: 'razorpay', level: 'high' })).toBe(false)
    const risky = { ...s, verification: { ...s.verification, sendTo: 'risky' as const } }
    expect(wantsCodConfirmation(risky, { paymentMethod: 'cod', level: 'low' })).toBe(false)
    expect(wantsCodConfirmation(risky, { paymentMethod: 'cod', level: 'medium' })).toBe(true)
    const off = { ...s, verification: { ...s.verification, enabled: false } }
    expect(wantsCodConfirmation(off, { paymentMethod: 'cod', level: 'high' })).toBe(false)
  })
})
