import { describe, expect, it } from 'vitest'
import { generateSku } from './sku'
import { convertWeight, fromGrams, toGrams } from './weight-units'

describe('generateSku', () => {
  it('shortens the handle and option values', () => {
    expect(generateSku('yuki-mechanical-glass-keyboard', ['Black', 'L'], [])).toBe(
      'YUKI-MECHA-GLASS-BLK-L',
    )
  })

  it('keeps values with digits as typed', () => {
    expect(generateSku('Phone', ['128GB', 'Blue'], [])).toBe('PHONE-128GB-BLU')
  })

  it('never repeats a SKU already on the product', () => {
    expect(generateSku('mug', ['Red'], ['MUG-RED', 'mug-red-2'])).toBe('MUG-RED-3')
  })
})

describe('weight units', () => {
  it('converts typed weights to whole grams', () => {
    expect(toGrams('1.25', 'kg')).toBe(1250)
    expect(toGrams('1', 'lb')).toBe(454)
    expect(toGrams('', 'kg')).toBeNull()
  })

  it('shows grams in the picked unit without trailing zeros', () => {
    expect(fromGrams(1250, 'kg')).toBe('1.25')
    expect(fromGrams(null, 'kg')).toBe('')
    expect(convertWeight('500', 'g', 'kg')).toBe('0.5')
  })
})
