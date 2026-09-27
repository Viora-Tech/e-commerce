/** SOURCE OF TRUTH: product form state — variant matrix reconciliation, SKU suggestion, stock-loss detection */
import { describe, expect, it } from 'bun:test'
import { dropsStock, emptyVariant, reconcileVariants, suggestSku } from './form-state'
import type { OptionRow, VariantRow } from './form-state'

function variant(optionValues: string[], patch: Partial<VariantRow> = {}): VariantRow {
  return { ...emptyVariant(optionValues), id: `id-${optionValues.join('-') || 'default'}`, ...patch }
}

describe('reconcileVariants', () => {
  it('builds one row per combination for a new option', () => {
    const options: OptionRow[] = [{ name: 'Size', values: ['S', 'M'] }]
    const next = reconcileVariants(options, [variant([])])
    expect(next.map((v) => v.optionValues)).toEqual([['S'], ['M']])
  })

  it('keeps existing ids and data when a value is added', () => {
    const previous = [variant(['S'], { price: '100', sku: 'SKU-S' }), variant(['M'], { price: '200' })]
    const options: OptionRow[] = [{ name: 'Size', values: ['S', 'M', 'L'] }]
    const next = reconcileVariants(options, previous)
    const s = next.find((v) => v.optionValues[0] === 'S')
    const m = next.find((v) => v.optionValues[0] === 'M')
    const l = next.find((v) => v.optionValues[0] === 'L')
    expect(s?.id).toBe('id-S')
    expect(s?.price).toBe('100')
    expect(s?.sku).toBe('SKU-S')
    expect(m?.id).toBe('id-M')
    // The new row has no id of its own yet.
    expect(l?.id).toBeUndefined()
  })

  it('drops the row for a removed value, keeping the rest', () => {
    const previous = [variant(['S'], { price: '100' }), variant(['M'], { price: '200' })]
    const options: OptionRow[] = [{ name: 'Size', values: ['S'] }]
    const next = reconcileVariants(options, previous)
    expect(next).toHaveLength(1)
    expect(next[0]?.id).toBe('id-S')
    expect(next[0]?.price).toBe('100')
  })

  it('rebuilds every combination across two options and keeps matches by title', () => {
    const previous = [
      variant(['S', 'Red'], { price: '100' }),
      variant(['M', 'Red'], { price: '200' }),
    ]
    const options: OptionRow[] = [
      { name: 'Size', values: ['S', 'M'] },
      { name: 'Colour', values: ['Red', 'Blue'] },
    ]
    const next = reconcileVariants(options, previous)
    expect(next).toHaveLength(4)
    const sRed = next.find((v) => v.optionValues.join('/') === 'S/Red')
    expect(sRed?.id).toBe('id-S-Red')
    expect(sRed?.price).toBe('100')
  })

  it('a brand-new value inherits price/tax/tracking defaults from an existing row', () => {
    const previous = [variant(['S'], { price: '150', taxable: false, trackInventory: false })]
    const options: OptionRow[] = [{ name: 'Size', values: ['S', 'M'] }]
    const next = reconcileVariants(options, previous)
    const m = next.find((v) => v.optionValues[0] === 'M')
    expect(m?.price).toBe('150')
    expect(m?.taxable).toBe(false)
    expect(m?.trackInventory).toBe(false)
  })
})

describe('dropsStock', () => {
  it('is false when nothing is removed', () => {
    const previous = [variant(['S'], { quantity: '5' })]
    const options: OptionRow[] = [{ name: 'Size', values: ['S', 'M'] }]
    expect(dropsStock(options, previous)).toBe(false)
  })

  it('is false when a removed value had no stock', () => {
    const previous = [variant(['S'], { quantity: '0' }), variant(['M'], { quantity: '5' })]
    const options: OptionRow[] = [{ name: 'Size', values: ['M'] }]
    expect(dropsStock(options, previous)).toBe(false)
  })

  it('is true when a removed value still has stock', () => {
    const previous = [variant(['S'], { quantity: '5' }), variant(['M'], { quantity: '0' })]
    const options: OptionRow[] = [{ name: 'Size', values: ['M'] }]
    expect(dropsStock(options, previous)).toBe(true)
  })
})

describe('suggestSku', () => {
  it('joins the title and option values, uppercased and hyphenated', () => {
    expect(suggestSku('Classic T-Shirt', ['Red', 'M'])).toBe('CLASSIC-T-SHIRT-RED-M')
  })

  it('drops accents and punctuation', () => {
    expect(suggestSku("Café Déjà Vu", [])).toBe('CAFE-DEJA-VU')
  })

  it('works with no option values', () => {
    expect(suggestSku('Gift Card', [])).toBe('GIFT-CARD')
  })
})
