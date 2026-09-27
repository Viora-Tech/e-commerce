/** SOURCE OF TRUTH: store tax settings tests — WHAT GSTIN checksum and state, inclusive vs exclusive GST maths, composition and the store.apps round trip / WHY these rules decide the tax on every order. */
import { describe, expect, it } from 'vitest'
import { computeGst, gstOnPrice } from './gst'
import { validateGstin } from './gstin'
import {
  COMPOSITION_NOTE,
  chargedGstRate,
  defaultStoreTaxSettings,
  gstinStateOf,
  parseStoreTax,
  TaxesFormSchema,
  withStoreTax,
} from './settings'

describe('GSTIN on the Taxes & GST form', () => {
  it('accepts a GSTIN whose check character matches', () => {
    expect(TaxesFormSchema.parse({ gstin: ' 27aapfu0939f1zv ' }).gstin).toBe('27AAPFU0939F1ZV')
    expect(TaxesFormSchema.parse({ gstin: '' }).gstin).toBe('')
  })

  it('names the problem: a typo in the last character, a bad state, or the wrong shape', () => {
    const issue = (gstin: string) =>
      TaxesFormSchema.safeParse({ gstin }).error?.issues[0]?.message ?? null
    expect(validateGstin('27AAPFU0939F1ZW')).toEqual({ ok: false, reason: 'checksum' })
    expect(issue('27AAPFU0939F1ZW')).toMatch(/typo/)
    expect(issue('99AAPFU0939F1ZV')).toMatch(/state code/)
    expect(issue('27AAPFU0939')).toMatch(/should look like/)
  })
})

describe('gstinStateOf', () => {
  it('reads the state from the first two digits', () => {
    expect(gstinStateOf('27AAPFU0939F1ZV')).toEqual({ code: 'MH', name: 'Maharashtra' })
    expect(gstinStateOf('06')).toEqual({ code: 'HR', name: 'Haryana' })
    expect(gstinStateOf('29aagcb7383j1z4')).toEqual({ code: 'KA', name: 'Karnataka' })
  })

  it('shows nothing until two digits of a real state code are typed', () => {
    expect(gstinStateOf('')).toBeNull()
    expect(gstinStateOf('2')).toBeNull()
    expect(gstinStateOf('99ABC')).toBeNull()
    expect(gstinStateOf('AB123')).toBeNull()
  })
})

describe('gstOnPrice: the ₹1,000 example', () => {
  it('takes GST out of a price that includes it', () => {
    expect(
      gstOnPrice({ pricePaise: 100_000, ratePercent: 18, inclusive: true, interState: false }),
    ).toEqual({
      taxablePaise: 84_746,
      taxPaise: 15_254,
      totalPaise: 100_000,
      cgstPaise: 7_627,
      sgstPaise: 7_627,
      igstPaise: 0,
    })
  })

  it('adds GST on top of a price that excludes it', () => {
    expect(
      gstOnPrice({ pricePaise: 100_000, ratePercent: 18, inclusive: false, interState: false }),
    ).toEqual({
      taxablePaise: 100_000,
      taxPaise: 18_000,
      totalPaise: 118_000,
      cgstPaise: 9_000,
      sgstPaise: 9_000,
      igstPaise: 0,
    })
  })

  it('charges one IGST line outside the state', () => {
    const r = gstOnPrice({
      pricePaise: 100_000,
      ratePercent: 18,
      inclusive: false,
      interState: true,
    })
    expect(r).toMatchObject({ taxPaise: 18_000, cgstPaise: 0, sgstPaise: 0, igstPaise: 18_000 })
  })

  it('gives the odd paisa to CGST so the halves add back', () => {
    const r = gstOnPrice({ pricePaise: 105, ratePercent: 18, inclusive: false, interState: false })
    expect(r).toMatchObject({ taxPaise: 19, cgstPaise: 10, sgstPaise: 9, totalPaise: 124 })
  })

  it('matches the checkout maths for inclusive prices', () => {
    for (const [pricePaise, ratePercent] of [
      [100_000, 18],
      [49_900, 5],
      [1_29_999, 28],
      [333, 3],
    ] as const) {
      const checkout = computeGst({
        amountPaise: pricePaise,
        ratePercent,
        shipToState: 'HR',
        storeState: 'HR',
      })
      const page = gstOnPrice({ pricePaise, ratePercent, inclusive: true, interState: false })
      expect(page.taxPaise).toBe(checkout.taxPaise)
      expect(page.cgstPaise).toBe(checkout.cgstPaise)
      expect(page.sgstPaise).toBe(checkout.sgstPaise)
    }
  })

  it('is zero at a zero rate', () => {
    expect(
      gstOnPrice({ pricePaise: 100_000, ratePercent: 0, inclusive: false, interState: false }),
    ).toMatchObject({ taxPaise: 0, totalPaise: 100_000 })
  })
})

describe('store tax switches', () => {
  it('defaults to prices including GST, not on the composition scheme', () => {
    expect(parseStoreTax(null)).toEqual({ pricesIncludeGst: true, composition: false })
    expect(parseStoreTax({ installed: ['gst-invoices'] })).toEqual(defaultStoreTaxSettings)
    expect(parseStoreTax({ installed: [], settings: { core: 'broken' } })).toEqual(
      defaultStoreTaxSettings,
    )
  })

  it('round-trips through store.apps without touching installed apps or other entries', () => {
    const before = {
      installed: ['gst-invoices', 'emi-pay-later'],
      settings: { 'emi-pay-later': { enabled: true }, core: { other: 1 } },
    }
    const after = withStoreTax(before, { pricesIncludeGst: false, composition: true })
    expect(after.installed).toEqual(before.installed)
    expect(after.settings?.['emi-pay-later']).toEqual({ enabled: true })
    expect(after.settings?.core).toEqual({
      other: 1,
      tax: { pricesIncludeGst: false, composition: true },
    })
    expect(parseStoreTax(after)).toEqual({ pricesIncludeGst: false, composition: true })
  })

  it('charges no GST under the composition scheme', () => {
    expect(chargedGstRate(18, { composition: false })).toBe(18)
    expect(chargedGstRate(18, { composition: true })).toBe(0)
    expect(chargedGstRate(-1, { composition: false })).toBe(0)
    expect(COMPOSITION_NOTE).toMatch(/^Composition taxable person/)
  })
})

describe('TaxesFormSchema', () => {
  it('fills defaults and checks HSN, PIN code and whole-percent rates', () => {
    expect(TaxesFormSchema.parse({})).toMatchObject({
      gstRatePercent: 18,
      pricesIncludeGst: true,
      composition: false,
      address: { line1: '', pincode: '' },
    })
    expect(TaxesFormSchema.safeParse({ defaultHsn: '8471' }).success).toBe(true)
    expect(TaxesFormSchema.safeParse({ defaultHsn: '84713' }).success).toBe(false)
    expect(TaxesFormSchema.safeParse({ address: { pincode: '12345' } }).success).toBe(false)
    expect(TaxesFormSchema.safeParse({ gstRatePercent: 12.5 }).success).toBe(false)
    expect(TaxesFormSchema.safeParse({ gstRatePercent: 41 }).success).toBe(false)
  })
})
