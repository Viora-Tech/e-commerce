import { describe, expect, it } from 'vitest'
import { percentToBps, protectCardOf, protectDraftOf } from './protect-draft'

describe('Delhivery Protect form', () => {
  it('reads typed percentages as basis points', () => {
    expect(percentToBps('0.25')).toBe(25)
    expect(percentToBps('')).toBeNull()
    expect(percentToBps('abc')).toBeUndefined()
    expect(percentToBps('11')).toBeUndefined()
  })

  it('keeps only the rates that differ from Delhivery’s and the named product types', () => {
    const draft = protectDraftOf(null)
    expect(draft.rates.computers).toBe('')
    draft.rates.computers = '0.5'
    draft.rates.health = '0.3' // Delhivery's own rate: not stored
    draft.overrides = [
      { productType: ' Glasspads ', category: 'computers' },
      { productType: '', category: 'apparel' },
    ]
    expect(protectCardOf(draft)).toEqual({
      ratesBps: { computers: 50 },
      typeOverrides: [{ productType: 'Glasspads', category: 'computers' }],
    })
  })

  it('refuses to save while a rate is unreadable', () => {
    const draft = protectDraftOf({ ratesBps: { apparel: 30 }, typeOverrides: [], couriers: {} })
    expect(draft.rates.apparel).toBe('0.3')
    draft.rates.apparel = 'x'
    expect(protectCardOf(draft)).toBeNull()
  })
})
