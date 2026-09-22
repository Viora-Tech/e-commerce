import { describe, expect, it } from 'vitest'
import { computeGst } from './gst'
import { sameState, stateCode } from './states'

describe('stateCode', () => {
  it('accepts codes, full names and nothing else', () => {
    expect(stateCode('HR')).toBe('HR')
    expect(stateCode('hr')).toBe('HR')
    expect(stateCode('Haryana')).toBe('HR')
    expect(stateCode('  maharashtra ')).toBe('MH')
    expect(stateCode('Atlantis')).toBeNull()
    expect(stateCode('')).toBeNull()
    expect(stateCode(null)).toBeNull()
  })

  it('treats an unknown side as not the same state', () => {
    expect(sameState('HR', 'Haryana')).toBe(true)
    expect(sameState('HR', 'MH')).toBe(false)
    expect(sameState('HR', null)).toBe(false)
    expect(sameState(null, null)).toBe(false)
  })
})

describe('computeGst', () => {
  it('extracts tax from a tax-inclusive amount', () => {
    // ₹1,180 at 18% inclusive carries ₹180 of tax.
    const gst = computeGst({
      amountPaise: 118_000,
      ratePercent: 18,
      shipToState: 'HR',
      storeState: 'HR',
    })
    expect(gst.taxPaise).toBe(18_000)
    expect(gst.interState).toBe(false)
  })

  it('splits CGST and SGST inside the state, to the paisa', () => {
    const gst = computeGst({
      amountPaise: 99_999,
      ratePercent: 18,
      shipToState: 'Haryana',
      storeState: 'HR',
    })
    expect(gst.cgstPaise + gst.sgstPaise).toBe(gst.taxPaise)
    expect(gst.cgstPaise - gst.sgstPaise).toBeLessThanOrEqual(1)
    expect(gst.igstPaise).toBe(0)
  })

  it('charges IGST across states', () => {
    const gst = computeGst({
      amountPaise: 118_000,
      ratePercent: 18,
      shipToState: 'MH',
      storeState: 'HR',
    })
    expect(gst.igstPaise).toBe(18_000)
    expect(gst.cgstPaise).toBe(0)
    expect(gst.sgstPaise).toBe(0)
    expect(gst.interState).toBe(true)
  })

  it('falls back to IGST when a state is missing', () => {
    const gst = computeGst({
      amountPaise: 118_000,
      ratePercent: 18,
      shipToState: null,
      storeState: 'HR',
    })
    expect(gst.interState).toBe(true)
    expect(gst.igstPaise).toBe(18_000)
  })

  it('returns nothing for zero rate or zero amount', () => {
    expect(
      computeGst({ amountPaise: 0, ratePercent: 18, shipToState: 'HR', storeState: 'HR' }).taxPaise,
    ).toBe(0)
    expect(
      computeGst({ amountPaise: 118_000, ratePercent: 0, shipToState: 'HR', storeState: 'HR' })
        .taxPaise,
    ).toBe(0)
  })
})
