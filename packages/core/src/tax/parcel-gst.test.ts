/** SOURCE OF TRUTH: parcel GST tests — WHAT: `computeOrderGst` and `gstRowsToShow` cases / WHY: guards the GST split on parcels */
import { describe, expect, it } from 'vitest'
import { computeOrderGst, gstRowsToShow } from './gst'
import { computeParcelGst, mergeOrderGst, type ParcelGstInput } from './parcel-gst'

const parcel = (
  key: string,
  originState: string,
  lines: [number, number][],
  composition = false,
): ParcelGstInput => ({
  key,
  originState,
  composition,
  lines: lines.map(([grossPaise, ratePercent]) => ({ grossPaise, ratePercent })),
})

describe('computeParcelGst', () => {
  it('one parcel is exactly the order-level computation', () => {
    const lines: [number, number][] = [
      [118_000, 18],
      [52_500, 5],
    ]
    const [only] = computeParcelGst({
      parcels: [parcel('0', 'HR', lines)],
      discountPaise: 10_001,
      adjustmentPaise: 4_900,
      shippingPaise: 9_900,
      shipToState: 'KA',
    })
    const total = 118_000 + 52_500 - 10_001 + 4_900 + 9_900
    expect(only?.totalPaise).toBe(total)
    expect(only?.gst).toEqual(
      computeOrderGst({
        lines: lines.map(([grossPaise, ratePercent]) => ({ grossPaise, ratePercent })),
        totalPaise: total,
        reductionPaise: 10_001,
        shipToState: 'KA',
        storeState: 'HR',
      }),
    )
    expect(mergeOrderGst(only ? [only.gst] : [])).toEqual(only?.gst)
  })

  it('each parcel splits its own GST by where it leaves from; totals never change', () => {
    const parts = computeParcelGst({
      parcels: [parcel('hr', 'HR', [[118_000, 18]]), parcel('dl', 'DL', [[118_000, 18]])],
      discountPaise: 0,
      adjustmentPaise: 0,
      shippingPaise: 0,
      shipToState: 'DL',
    })
    const [hr, dl] = parts
    // Haryana to Delhi is inter-state (IGST); Delhi to Delhi is CGST + SGST.
    expect(hr?.gst).toMatchObject({ taxPaise: 18_000, igstPaise: 18_000, cgstPaise: 0 })
    expect(dl?.gst).toMatchObject({ taxPaise: 18_000, igstPaise: 0, cgstPaise: 9_000 })
    expect(parts.reduce((n, p) => n + p.totalPaise, 0)).toBe(236_000)
    const order = mergeOrderGst(parts.map((p) => p.gst))
    expect(order).toMatchObject({
      taxPaise: 36_000,
      cgstPaise: 9_000,
      sgstPaise: 9_000,
      igstPaise: 18_000,
      ratePercent: 18,
      interState: false,
    })
    expect(order.byRate).toEqual([
      expect.objectContaining({ ratePercent: 18, amountPaise: 236_000, taxPaise: 36_000 }),
    ])
    expect(gstRowsToShow(order)).toEqual({ intraState: true, interState: true })
  })

  it('shares discount, fee and shipping by goods value, adding back to the paisa', () => {
    const parts = computeParcelGst({
      parcels: [
        parcel('a', 'HR', [[100_000, 18]]),
        parcel('b', 'DL', [[100_000, 18]]),
        parcel('c', 'MH', [[100_000, 18]]),
      ],
      discountPaise: 10_001,
      adjustmentPaise: -2_999,
      shippingPaise: 101,
      shipToState: 'HR',
    })
    expect(parts.map((p) => p.discountPaise).reduce((a, b) => a + b)).toBe(10_001)
    expect(parts.map((p) => p.adjustmentPaise).reduce((a, b) => a + b)).toBe(-2_999)
    expect(parts.map((p) => p.shippingPaise).reduce((a, b) => a + b)).toBe(101)
    expect(parts.every((p) => p.adjustmentPaise <= 0)).toBe(true)
    expect(parts.map((p) => p.shippingPaise)).toEqual([34, 34, 33])
    expect(parts.reduce((n, p) => n + p.totalPaise, 0)).toBe(300_000 - 10_001 - 2_999 + 101)
    for (const p of parts) {
      expect(p.totalPaise).toBe(
        p.subtotalPaise - p.discountPaise + p.adjustmentPaise + p.shippingPaise,
      )
    }
  })

  it('weights the shares by each parcel’s goods value', () => {
    const [big, small] = computeParcelGst({
      parcels: [parcel('big', 'HR', [[300_000, 18]]), parcel('small', 'DL', [[100_000, 5]])],
      discountPaise: 40_000,
      adjustmentPaise: 0,
      shippingPaise: 10_000,
      shipToState: 'HR',
    })
    expect([big?.discountPaise, small?.discountPaise]).toEqual([30_000, 10_000])
    expect([big?.shippingPaise, small?.shippingPaise]).toEqual([7_500, 2_500])
    expect(small?.gst).toMatchObject({ ratePercent: 5, igstPaise: small?.gst.taxPaise })
  })

  it('a parcel under a composition GSTIN charges no GST; the shopper pays the same', () => {
    const [comp, regular] = computeParcelGst({
      parcels: [parcel('comp', 'HR', [[118_000, 18]], true), parcel('reg', 'HR', [[118_000, 18]])],
      discountPaise: 0,
      adjustmentPaise: 0,
      shippingPaise: 0,
      shipToState: 'HR',
    })
    expect(comp?.totalPaise).toBe(118_000)
    expect(comp?.gst.taxPaise).toBe(0)
    expect(regular?.gst.taxPaise).toBe(18_000)
  })
})

describe('mergeOrderGst', () => {
  it('merges rates row by row; the headline rate is the one with the most value', () => {
    const parts = computeParcelGst({
      parcels: [
        parcel('a', 'HR', [
          [10_500, 5],
          [11_800, 18],
        ]),
        parcel('b', 'DL', [[52_500, 5]]),
      ],
      discountPaise: 0,
      adjustmentPaise: 0,
      shippingPaise: 0,
      shipToState: 'HR',
    })
    const order = mergeOrderGst(parts.map((p) => p.gst))
    expect(order.byRate.map((r) => [r.ratePercent, r.amountPaise])).toEqual([
      [5, 63_000],
      [18, 11_800],
    ])
    expect(order.ratePercent).toBe(5)
    expect(order.taxPaise).toBe(parts.reduce((n, p) => n + p.gst.taxPaise, 0))
  })

  it('is inter-state only when every parcel is', () => {
    const parts = computeParcelGst({
      parcels: [parcel('a', 'HR', [[1_180, 18]]), parcel('b', 'DL', [[1_180, 18]])],
      discountPaise: 0,
      adjustmentPaise: 0,
      shippingPaise: 0,
      shipToState: 'KA',
    })
    const order = mergeOrderGst(parts.map((p) => p.gst))
    expect(order.interState).toBe(true)
    expect(gstRowsToShow(order)).toEqual({ intraState: false, interState: true })
  })
})

describe('gstRowsToShow', () => {
  it('follows interState for an order from one state', () => {
    expect(gstRowsToShow({ cgstPaise: 0, sgstPaise: 0, igstPaise: 900, interState: true })).toEqual(
      { intraState: false, interState: true },
    )
    expect(
      gstRowsToShow({ cgstPaise: 450, sgstPaise: 450, igstPaise: 0, interState: false }),
    ).toEqual({ intraState: true, interState: false })
  })
})
