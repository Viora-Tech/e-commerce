/** SOURCE OF TRUTH: draft order GST tests — WHAT: a draft line's rate and the estimated GST / WHY: guard the draft order editor's tax line */
import { describe, expect, it } from 'vitest'
import { draftLineRate, estimateDraftGst } from './draft-gst'

const base = {
  storeRatePercent: 18,
  tax: { composition: false },
  reductionPaise: 0,
  shipToState: 'HR',
  storeState: 'HR',
}

const line = (grossPaise: number, over: Partial<Parameters<typeof draftLineRate>[0]> = {}) => ({
  grossPaise,
  ratePercent: null,
  taxable: true,
  giftCard: false,
  ...over,
})

describe('draftLineRate', () => {
  it('uses the line rate, else the store default', () => {
    expect(
      draftLineRate({ ratePercent: 5, taxable: true, giftCard: false }, 18, { composition: false }),
    ).toBe(5)
    expect(
      draftLineRate({ ratePercent: null, taxable: true, giftCard: false }, 18, {
        composition: false,
      }),
    ).toBe(18)
  })

  it('charges nothing on untaxed lines, gift cards and composition stores', () => {
    expect(
      draftLineRate({ ratePercent: 18, taxable: false, giftCard: false }, 18, {
        composition: false,
      }),
    ).toBe(0)
    expect(
      draftLineRate({ ratePercent: 18, taxable: true, giftCard: true }, 18, { composition: false }),
    ).toBe(0)
    expect(
      draftLineRate({ ratePercent: 18, taxable: true, giftCard: false }, 18, { composition: true }),
    ).toBe(0)
  })
})

describe('estimateDraftGst', () => {
  it('extracts GST from inside the total at the store rate', () => {
    // ₹1,180 at 18% contains ₹180.
    const r = estimateDraftGst({ ...base, lines: [line(118_000)], totalPaise: 118_000 })
    expect(r).toEqual({ taxPaise: 18_000, ratePercent: 18, inclusive: true })
  })

  it('spreads the discount and taxes shipping with the goods', () => {
    // ₹1,000 goods − ₹100 discount + ₹280 shipping = ₹1,180, all at 18%.
    const r = estimateDraftGst({
      ...base,
      lines: [line(100_000)],
      reductionPaise: 10_000,
      totalPaise: 118_000,
    })
    expect(r.taxPaise).toBe(18_000)
  })

  it('reports no single rate when lines differ, and sums each group', () => {
    const r = estimateDraftGst({
      ...base,
      lines: [line(10_500, { ratePercent: 5 }), line(11_800)],
      totalPaise: 22_300,
    })
    expect(r.ratePercent).toBeNull()
    expect(r.taxPaise).toBe(500 + 1_800)
  })

  it('is zero for untaxed custom items and empty drafts', () => {
    expect(
      estimateDraftGst({ ...base, lines: [line(50_000, { ratePercent: 0 })], totalPaise: 50_000 })
        .taxPaise,
    ).toBe(0)
    expect(estimateDraftGst({ ...base, lines: [], totalPaise: 0 }).taxPaise).toBe(0)
  })
})
