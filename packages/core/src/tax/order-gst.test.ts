import { describe, expect, it } from 'vitest'
import { allocatePaise, computeGst, computeOrderGst } from './gst'
import { GST_STATE_CODES, gstinCheckChar, gstState, panFromGstin, validateGstin } from './gstin'

describe('allocatePaise', () => {
  it('always adds back to the total', () => {
    expect(allocatePaise(100, [1, 1, 1])).toEqual([34, 33, 33])
    expect(allocatePaise(7, [0, 0])).toEqual([7, 0])
    expect(allocatePaise(0, [5, 5])).toEqual([0, 0])
    const parts = allocatePaise(99_999, [3, 7, 11, 13])
    expect(parts.reduce((a, b) => a + b, 0)).toBe(99_999)
  })
})

describe('computeOrderGst', () => {
  const place = { shipToState: 'MH', storeState: 'HR' }

  it('is exactly computeGst on the total when every line shares a rate', () => {
    const order = computeOrderGst({
      lines: [
        { grossPaise: 249_900, ratePercent: 18 },
        { grossPaise: 99_900, ratePercent: 18 },
      ],
      totalPaise: 339_800,
      ...place,
    })
    const single = computeGst({ amountPaise: 339_800, ratePercent: 18, ...place })
    expect(order.taxPaise).toBe(single.taxPaise)
    expect(order.igstPaise).toBe(single.igstPaise)
    expect(order.byRate).toHaveLength(1)
    expect(order.byRate[0]?.amountPaise).toBe(339_800)
  })

  it('splits a mixed-rate cart, spreading a discount by value and shipping to the principal rate', () => {
    // ₹2,000 of goods at 18% and ₹1,000 at 12%; ₹300 discount; ₹100 shipping.
    const order = computeOrderGst({
      lines: [
        { grossPaise: 200_000, ratePercent: 18 },
        { grossPaise: 100_000, ratePercent: 12 },
      ],
      totalPaise: 280_000,
      ...place,
    })
    const [twelve, eighteen] = order.byRate
    // Net delta is -₹200: a reduction spread 2:1, so no charge reaches the principal.
    expect(twelve).toMatchObject({ ratePercent: 12, amountPaise: 93_333 })
    expect(eighteen).toMatchObject({ ratePercent: 18, amountPaise: 186_667 })
    expect((twelve?.amountPaise ?? 0) + (eighteen?.amountPaise ?? 0)).toBe(280_000)
    expect(order.taxPaise).toBe((twelve?.taxPaise ?? 0) + (eighteen?.taxPaise ?? 0))
    expect(order.ratePercent).toBe(18)
    expect(order.interState).toBe(true)
  })

  it('spreads an explicit discount over goods while shipping stays with the principal', () => {
    // Same cart: ₹300 off spread 2:1, then ₹100 shipping on the 18% group.
    const order = computeOrderGst({
      lines: [
        { grossPaise: 200_000, ratePercent: 18 },
        { grossPaise: 100_000, ratePercent: 12 },
      ],
      totalPaise: 280_000,
      reductionPaise: 30_000,
      ...place,
    })
    expect(order.byRate.map((r) => [r.ratePercent, r.amountPaise])).toEqual([
      [12, 90_000],
      [18, 190_000],
    ])
  })

  it('leaves exempt lines untaxed', () => {
    const order = computeOrderGst({
      lines: [
        { grossPaise: 50_000, ratePercent: 0 },
        { grossPaise: 100_000, ratePercent: 5 },
      ],
      totalPaise: 150_000,
      ...place,
    })
    expect(order.byRate).toHaveLength(1)
    expect(order.byRate[0]).toMatchObject({ ratePercent: 5, amountPaise: 100_000, taxPaise: 4_762 })
  })

  it('puts a net charge on the principal rate group', () => {
    const order = computeOrderGst({
      lines: [
        { grossPaise: 100_000, ratePercent: 5 },
        { grossPaise: 300_000, ratePercent: 18 },
      ],
      totalPaise: 410_000,
      shipToState: 'HR',
      storeState: 'Haryana',
    })
    const eighteen = order.byRate.find((r) => r.ratePercent === 18)
    const five = order.byRate.find((r) => r.ratePercent === 5)
    expect(eighteen?.amountPaise).toBe(310_000)
    expect(five?.amountPaise).toBe(100_000)
    expect(order.igstPaise).toBe(0)
    expect(order.cgstPaise + order.sgstPaise).toBe(order.taxPaise)
  })
})

describe('GSTIN', () => {
  it('accepts published GSTINs and rejects a one-character typo', () => {
    expect(validateGstin('27AAPFU0939F1ZV')).toEqual({ ok: true, gstin: '27AAPFU0939F1ZV' })
    expect(validateGstin('29aagcb7383j1z4').ok).toBe(true)
    expect(validateGstin('27AAPFU0939F1ZW')).toEqual({ ok: false, reason: 'checksum' })
    expect(validateGstin('99AAPFU0939F1ZV')).toEqual({ ok: false, reason: 'state' })
    expect(validateGstin('not a gstin')).toEqual({ ok: false, reason: 'shape' })
  })

  it('derives PAN, check character and state', () => {
    expect(panFromGstin('27AAPFU0939F1ZV')).toBe('AAPFU0939F')
    expect(gstinCheckChar('27AAPFU0939F1Z')).toBe('V')
    expect(gstState('hr')).toEqual({ code: 'HR', gstCode: '06', name: 'Haryana' })
    expect(gstState('XX')).toBeNull()
    expect(GST_STATE_CODES.MH).toBe('27')
  })
})
