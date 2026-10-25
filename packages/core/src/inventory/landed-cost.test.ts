/** SOURCE OF TRUTH: tests for the landed cost maths (FX, splits, rounding, WAC, revaluation) */
import {
  INBOUND_SHIPMENT_STATUS_VALUES,
  PURCHASE_CHARGE_KIND_VALUES,
  SPLIT_METHOD_VALUES,
} from '@commerce/db'
import { describe, expect, it } from 'vitest'
import {
  allocate,
  type CostCharge,
  type CostLine,
  computeLandedCosts,
  convertToPaise,
  defaultRecoverable,
  defaultSplitMethod,
  divRound,
  INBOUND_SHIPMENT_STATUSES,
  minorToText,
  PURCHASE_CHARGE_KINDS,
  parseAmountMinor,
  parseFxRate,
  revaluedCost,
  SPLIT_METHODS,
  weightedAverageCost,
} from './landed-cost'
import { FxRateSchema, PurchaseChargeInputSchema } from './schemas'

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0)

const line = (id: string, over: Partial<CostLine> = {}): CostLine => ({
  id,
  quantity: 1,
  goodsPaise: 100,
  weightGrams: 100,
  ...over,
})

const charge = (over: Partial<CostCharge> = {}): CostCharge => ({
  id: 'c1',
  amountPaise: 1000,
  recoverable: false,
  splitMethod: 'by_value',
  lineIds: ['a', 'b', 'c'],
  ...over,
})

describe('the lists match the database', () => {
  it('charge kinds, split methods and shipment statuses', () => {
    expect([...PURCHASE_CHARGE_KINDS]).toEqual([...PURCHASE_CHARGE_KIND_VALUES])
    expect([...SPLIT_METHODS]).toEqual([...SPLIT_METHOD_VALUES])
    expect([...INBOUND_SHIPMENT_STATUSES]).toEqual([...INBOUND_SHIPMENT_STATUS_VALUES])
  })
})

describe('rounding', () => {
  it('rounds half up, away from zero for negatives', () => {
    expect(divRound(5n, 2n)).toBe(3n)
    expect(divRound(4n, 3n)).toBe(1n)
    expect(divRound(5n, 3n)).toBe(2n)
    expect(divRound(-5n, 2n)).toBe(-3n)
    expect(divRound(-4n, 3n)).toBe(-1n)
    expect(divRound(0n, 7n)).toBe(0n)
  })
})

describe('FX', () => {
  it('parses a rate to millionths and refuses nonsense', () => {
    expect(parseFxRate('83.25')).toBe(83_250_000n)
    expect(parseFxRate(' 1 ')).toBe(1_000_000n)
    expect(parseFxRate('0.000001')).toBe(1n)
    expect(parseFxRate('0')).toBeNull()
    expect(parseFxRate('1.1234567')).toBeNull()
    expect(parseFxRate('-2')).toBeNull()
    expect(parseFxRate('abc')).toBeNull()
    expect(FxRateSchema.safeParse('0').success).toBe(false)
    expect(FxRateSchema.safeParse('83.123456').success).toBe(true)
  })

  it('converts minor units to paise, rounding half up', () => {
    // $1,234.56 at ₹83.25 = ₹102,777.12
    expect(convertToPaise(123_456, 'USD', '83.25')).toBe(10_277_712)
    // ¥1,000 (no minor unit) at ₹0.5612 = ₹561.20
    expect(convertToPaise(1000, 'JPY', '0.5612')).toBe(56_120)
    // 1 cent at ₹83.255 = 83.255 paise → 83
    expect(convertToPaise(1, 'USD', '83.255')).toBe(83)
    // 3 cents at ₹83.5 = 250.5 paise → 251
    expect(convertToPaise(3, 'USD', '83.5')).toBe(251)
    // a credit rounds away from zero
    expect(convertToPaise(-3, 'USD', '83.5')).toBe(-251)
  })

  it('passes INR through whatever the rate says', () => {
    expect(convertToPaise(12_345, 'INR', '83')).toBe(12_345)
  })

  it('throws on a bad rate for a foreign currency', () => {
    expect(() => convertToPaise(100, 'USD', '0')).toThrow(RangeError)
  })
})

describe('typed amounts', () => {
  it('reads text into minor units without floats', () => {
    expect(parseAmountMinor('1,200.5', 'USD')).toBe(120_050)
    expect(parseAmountMinor('0.1', 'USD')).toBe(10)
    expect(parseAmountMinor('.75', 'INR')).toBe(75)
    expect(parseAmountMinor('1000', 'JPY')).toBe(1000)
    expect(parseAmountMinor('10.5', 'JPY')).toBeNull()
    expect(parseAmountMinor('1.234', 'USD')).toBeNull()
    expect(parseAmountMinor('-30', 'INR')).toBeNull()
    expect(parseAmountMinor('-30', 'INR', true)).toBe(-3000)
    expect(parseAmountMinor('', 'INR')).toBeNull()
    expect(parseAmountMinor('abc', 'INR')).toBeNull()
  })

  it('writes minor units back as plain text', () => {
    expect(minorToText(120_050, 'USD')).toBe('1200.5')
    expect(minorToText(5, 'USD')).toBe('0.05')
    expect(minorToText(-3000, 'INR')).toBe('-30')
    expect(minorToText(1000, 'JPY')).toBe('1000')
    expect(minorToText(0, 'INR')).toBe('')
  })
})

describe('allocate (largest remainder)', () => {
  it('always sums to the total exactly', () => {
    for (const total of [1, 2, 99, 100, 101, 999_999, 12_345_678]) {
      for (const weights of [
        [1, 1, 1],
        [3, 7],
        [1, 2, 3, 4, 5, 6, 7],
        [5_000, 1, 1],
        [0, 1, 0],
      ]) {
        expect(sum(allocate(total, weights))).toBe(total)
      }
    }
  })

  it('gives the leftover paise to the largest remainders, earlier lines on a tie', () => {
    expect(allocate(100, [1, 1, 1])).toEqual([34, 33, 33])
    expect(allocate(10, [1, 2])).toEqual([3, 7])
    // 7 × 1/6 = 1.1667 and 7 × 5/6 = 5.8333 → floors 1 + 5, the leftover paisa goes to the .8333
    expect(allocate(7, [1, 5])).toEqual([1, 6])
  })

  it('splits a credit as a negative of the same split', () => {
    expect(allocate(-100, [1, 1, 1])).toEqual([-34, -33, -33])
    expect(sum(allocate(-101, [2, 3]))).toBe(-101)
  })

  it('never lands anything on a zero weight', () => {
    expect(allocate(5, [0, 1, 1])).toEqual([0, 3, 2])
  })

  it('needs one positive weight', () => {
    expect(() => allocate(5, [0, 0])).toThrow(RangeError)
  })
})

describe('computeLandedCosts', () => {
  it('splits freight by weight: heavier lines carry more', () => {
    const lines = [
      line('a', { quantity: 10, weightGrams: 500, goodsPaise: 100_000 }),
      line('b', { quantity: 5, weightGrams: 2000, goodsPaise: 100_000 }),
    ]
    // 5,000 g vs 10,000 g of ₹300
    const r = computeLandedCosts(lines, [
      charge({ amountPaise: 30_000, splitMethod: 'by_weight', lineIds: ['a', 'b'] }),
    ])
    expect(r.charges[0]?.splits).toEqual([
      { lineId: 'a', amountPaise: 10_000 },
      { lineId: 'b', amountPaise: 20_000 },
    ])
    expect(r.warnings).toEqual([])
    expect(r.lines[0]).toMatchObject({ chargesPaise: 10_000, landedUnitPaise: 11_000 })
    expect(r.lines[1]).toMatchObject({ chargesPaise: 20_000, landedUnitPaise: 24_000 })
  })

  it('falls back to value when a line has no weight, and says which', () => {
    const lines = [
      line('a', { weightGrams: 100, goodsPaise: 300 }),
      line('b', { weightGrams: null, goodsPaise: 100 }),
      line('c', { weightGrams: 0, goodsPaise: 600 }),
    ]
    const r = computeLandedCosts(lines, [charge({ splitMethod: 'by_weight' })])
    expect(r.warnings).toEqual([{ code: 'missing_weight', chargeId: 'c1', lineIds: ['b', 'c'] }])
    expect(r.charges[0]?.method).toBe('by_value')
    expect(r.charges[0]?.splits.map((s) => s.amountPaise)).toEqual([300, 100, 600])
  })

  it('splits by value and by quantity', () => {
    const lines = [
      line('a', { quantity: 1, goodsPaise: 100 }),
      line('b', { quantity: 3, goodsPaise: 300 }),
    ]
    const byValue = computeLandedCosts(lines, [charge({ amountPaise: 400, lineIds: ['a', 'b'] })])
    expect(byValue.charges[0]?.splits.map((s) => s.amountPaise)).toEqual([100, 300])
    const byQty = computeLandedCosts(lines, [
      charge({ amountPaise: 100, splitMethod: 'by_quantity', lineIds: ['a', 'b'] }),
    ])
    expect(byQty.charges[0]?.splits.map((s) => s.amountPaise)).toEqual([25, 75])
  })

  it('puts a charge on specific lines only', () => {
    const lines = [line('a', { goodsPaise: 100 }), line('b', { goodsPaise: 300 }), line('c')]
    const r = computeLandedCosts(lines, [
      charge({ amountPaise: 1000, splitMethod: 'specific_lines', splitLineIds: ['b', 'c'] }),
    ])
    expect(r.charges[0]?.splits.map((s) => s.amountPaise)).toEqual([0, 750, 250])
  })

  it('takes manual amounts that add up, and falls back to value when they do not', () => {
    const lines = [line('a', { goodsPaise: 100 }), line('b', { goodsPaise: 100 })]
    const ok = computeLandedCosts(lines, [
      charge({
        amountPaise: 1000,
        lineIds: ['a', 'b'],
        splitMethod: 'manual',
        manualSplits: [
          { lineId: 'a', amountPaise: 900 },
          { lineId: 'b', amountPaise: 100 },
        ],
      }),
    ])
    expect(ok.charges[0]?.splits.map((s) => s.amountPaise)).toEqual([900, 100])
    const off = computeLandedCosts(lines, [
      charge({
        amountPaise: 1000,
        lineIds: ['a', 'b'],
        splitMethod: 'manual',
        manualSplits: [{ lineId: 'a', amountPaise: 900 }],
      }),
    ])
    expect(off.warnings).toEqual([
      { code: 'manual_mismatch', chargeId: 'c1', expectedPaise: 1000, gotPaise: 900 },
    ])
    expect(off.charges[0]?.splits.map((s) => s.amountPaise)).toEqual([500, 500])
  })

  it('keeps recoverable IGST and service GST out of landed cost', () => {
    const lines = [line('a', { quantity: 10, goodsPaise: 1_000_000 })]
    const r = computeLandedCosts(lines, [
      charge({ id: 'bcd', amountPaise: 100_000, lineIds: ['a'] }),
      charge({ id: 'igst', amountPaise: 198_000, recoverable: true, lineIds: ['a'] }),
    ])
    expect(r.lines[0]).toEqual({
      lineId: 'a',
      goodsPaise: 1_000_000,
      chargesPaise: 100_000,
      recoverablePaise: 198_000,
      landedTotalPaise: 1_100_000,
      landedUnitPaise: 110_000,
    })
  })

  it('splits by quantity when every line is worth nothing', () => {
    const lines = [
      line('a', { goodsPaise: 0, quantity: 1 }),
      line('b', { goodsPaise: 0, quantity: 3 }),
    ]
    const r = computeLandedCosts(lines, [charge({ amountPaise: 400, lineIds: ['a', 'b'] })])
    expect(r.warnings).toEqual([{ code: 'zero_basis', chargeId: 'c1' }])
    expect(r.charges[0]?.splits.map((s) => s.amountPaise)).toEqual([100, 300])
  })

  it('warns when a charge has nothing to land on', () => {
    const r = computeLandedCosts([line('a')], [charge({ lineIds: [] })])
    expect(r.warnings).toEqual([{ code: 'no_lines', chargeId: 'c1' }])
    expect(r.lines[0]?.chargesPaise).toBe(0)
  })

  it('rounds the unit cost half up, and splits always sum to each charge', () => {
    const lines = [
      line('a', { quantity: 3, goodsPaise: 1000, weightGrams: 7 }),
      line('b', { quantity: 7, goodsPaise: 2333, weightGrams: 11 }),
      line('c', { quantity: 11, goodsPaise: 4999, weightGrams: 13 }),
    ]
    const charges = [
      charge({ id: 'w', amountPaise: 10_001, splitMethod: 'by_weight' }),
      charge({ id: 'v', amountPaise: 3_333 }),
      charge({ id: 'q', amountPaise: 1_000, splitMethod: 'by_quantity' }),
    ]
    const r = computeLandedCosts(lines, charges)
    for (const [i, c] of charges.entries()) {
      expect(sum(r.charges[i]?.splits.map((s) => s.amountPaise) ?? [])).toBe(c.amountPaise)
    }
    const total = sum(r.lines.map((l) => l.landedTotalPaise))
    expect(total).toBe(1000 + 2333 + 4999 + 10_001 + 3_333 + 1_000)
    // (1000 + its splits) / 3, half up
    const a = r.lines[0]
    expect(a?.landedUnitPaise).toBe(Number(divRound(BigInt(a?.landedTotalPaise ?? 0), 3n)))
  })
})

describe('weighted average cost', () => {
  it('takes the landed cost when the shelf is empty or the cost unknown', () => {
    expect(
      weightedAverageCost({
        onHandBefore: 0,
        costBefore: 500,
        receivedQty: 10,
        landedUnitPaise: 800,
      }),
    ).toBe(800)
    expect(
      weightedAverageCost({
        onHandBefore: -3,
        costBefore: 500,
        receivedQty: 10,
        landedUnitPaise: 800,
      }),
    ).toBe(800)
    expect(
      weightedAverageCost({
        onHandBefore: 5,
        costBefore: null,
        receivedQty: 10,
        landedUnitPaise: 800,
      }),
    ).toBe(800)
  })

  it('averages by units, rounding half up', () => {
    // (10 × 500 + 10 × 800) / 20 = 650
    expect(
      weightedAverageCost({
        onHandBefore: 10,
        costBefore: 500,
        receivedQty: 10,
        landedUnitPaise: 800,
      }),
    ).toBe(650)
    // (1 × 100 + 2 × 101) / 3 = 100.667 → 101
    expect(
      weightedAverageCost({
        onHandBefore: 1,
        costBefore: 100,
        receivedQty: 2,
        landedUnitPaise: 101,
      }),
    ).toBe(101)
    // (1 × 100 + 1 × 101) / 2 = 100.5 → 101
    expect(
      weightedAverageCost({
        onHandBefore: 1,
        costBefore: 100,
        receivedQty: 1,
        landedUnitPaise: 101,
      }),
    ).toBe(101)
  })
})

describe('revaluation', () => {
  it('moves only the share still on hand', () => {
    // 10 received, a late ₹10 (1000 paise) bill: 100 paise per unit. 4 sold, 6 left of 6 on hand.
    expect(revaluedCost({ onHand: 6, cost: 1000, deltaPaise: 1000, units: 10 })).toEqual({
      cost: 1100,
      appliedPaise: 600,
    })
    // More on hand than this order brought in: only its 10 units move, spread over 20.
    expect(revaluedCost({ onHand: 20, cost: 1000, deltaPaise: 1000, units: 10 })).toEqual({
      cost: 1050,
      appliedPaise: 1000,
    })
  })

  it('does nothing when everything is sold or nothing changed', () => {
    expect(revaluedCost({ onHand: 0, cost: 1000, deltaPaise: 500, units: 10 })).toEqual({
      cost: 1000,
      appliedPaise: 0,
    })
    expect(revaluedCost({ onHand: 5, cost: 1000, deltaPaise: 0, units: 10 }).appliedPaise).toBe(0)
  })

  it('lowers the cost for a credit, never below zero', () => {
    expect(revaluedCost({ onHand: 10, cost: 1000, deltaPaise: -2000, units: 10 }).cost).toBe(800)
    expect(revaluedCost({ onHand: 10, cost: 10, deltaPaise: -100_000, units: 10 }).cost).toBe(0)
  })
})

describe('defaults and input rules', () => {
  it('splits freight by weight and keeps customs IGST recoverable', () => {
    expect(defaultSplitMethod('freight_insurance')).toBe('by_weight')
    expect(defaultSplitMethod('customs_bcd')).toBe('by_value')
    expect(defaultRecoverable('customs_igst')).toBe(true)
    expect(defaultRecoverable('cha_fee')).toBe(false)
  })

  it('takes a charge on one owner, negative only as a goods adjustment', () => {
    const id = '0190e3f6-1a2b-7c3d-8e4f-5a6b7c8d9e0f'
    const ok = { purchaseOrderId: id, kind: 'cha_fee', amountMinor: 100 }
    expect(PurchaseChargeInputSchema.safeParse(ok).success).toBe(true)
    expect(PurchaseChargeInputSchema.safeParse({ ...ok, inboundShipmentId: id }).success).toBe(
      false,
    )
    expect(PurchaseChargeInputSchema.safeParse({ ...ok, amountMinor: -5 }).success).toBe(false)
    expect(
      PurchaseChargeInputSchema.safeParse({ ...ok, kind: 'goods_adjustment', amountMinor: -5 })
        .success,
    ).toBe(true)
    expect(
      PurchaseChargeInputSchema.safeParse({ ...ok, splitMethod: 'specific_lines' }).success,
    ).toBe(false)
  })
})
