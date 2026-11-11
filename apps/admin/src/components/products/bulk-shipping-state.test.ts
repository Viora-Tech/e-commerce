import { describe, expect, it } from 'vitest'
import { bulkShippingChoice, KEEP, NONE } from './bulk-shipping-state'

describe('bulkShippingChoice', () => {
  it('is not ready when nothing changes', () => {
    expect(bulkShippingChoice('', KEEP)).toEqual({
      weightGrams: undefined,
      boxPresetId: undefined,
      ready: false,
    })
  })

  it('ignores a zero weight', () => {
    expect(bulkShippingChoice('0', KEEP).ready).toBe(false)
  })

  it('takes a positive weight in grams', () => {
    expect(bulkShippingChoice('250', KEEP)).toMatchObject({ weightGrams: 250, ready: true })
  })

  it('clears the box for NONE and sets a preset id otherwise', () => {
    expect(bulkShippingChoice('', NONE)).toMatchObject({ boxPresetId: null, ready: true })
    expect(bulkShippingChoice('', 'box_1')).toMatchObject({ boxPresetId: 'box_1', ready: true })
  })
})
