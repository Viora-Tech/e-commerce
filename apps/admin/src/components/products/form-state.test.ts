/** SOURCE OF TRUTH: product form state: variant matrix reconciliation, SKU suggestion, stock-loss detection */
import { describe, expect, it } from 'vitest'
import { productFormContent } from '@/data/product-form'
import {
  emptyForm,
  emptyVariant,
  formErrors,
  fromProduct,
  inheritedPreorderLimit,
  type LoadedProduct,
  type OptionRow,
  stockOf,
  suggestSku,
  toWrite,
  type VariantRow,
  validVariantLimit,
  variantPreorderContext,
} from './form-state'
import { matrixOptions, reconcileVariants } from './variant-reconcile'

function variant(optionValues: string[], patch: Partial<VariantRow> = {}): VariantRow {
  return {
    ...emptyVariant(optionValues),
    id: `id-${optionValues.join('-') || 'default'}`,
    ...patch,
  }
}

const size = (...values: string[]): OptionRow => ({ name: 'Size', values })
const colour = (...values: string[]): OptionRow => ({ name: 'Colour', values })

describe('reconcileVariants', () => {
  it('builds one row per combination for a new option, keeping the default variant id', () => {
    const { variants, dropped } = reconcileVariants([size('S', 'M')], [], [variant([])])
    expect(variants.map((v) => v.optionValues)).toEqual([['S'], ['M']])
    expect(variants[0]?.id).toBe('id-default')
    expect(variants[1]?.id).toBeUndefined()
    expect(dropped).toEqual([])
  })

  it('keeps existing ids and data when a value is added', () => {
    const previous = [
      variant(['S'], { price: '100', sku: 'SKU-S' }),
      variant(['M'], { price: '200' }),
    ]
    const { variants } = reconcileVariants([size('S', 'M', 'L')], [size('S', 'M')], previous)
    const [s, m, l] = variants
    expect(s?.id).toBe('id-S')
    expect(s?.price).toBe('100')
    expect(s?.sku).toBe('SKU-S')
    expect(m?.id).toBe('id-M')
    expect(l?.id).toBeUndefined()
    expect(l?.sku).toBe('')
  })

  it('drops the row for a removed value and reports it', () => {
    const previous = [variant(['S'], { price: '100' }), variant(['M'], { price: '200' })]
    const { variants, dropped } = reconcileVariants([size('S')], [size('S', 'M')], previous)
    expect(variants).toHaveLength(1)
    expect(variants[0]?.id).toBe('id-S')
    expect(dropped.map((v) => v.id)).toEqual(['id-M'])
  })

  it('carries each row into the first combination when a second option is added', () => {
    const previous = [variant(['S'], { quantity: '4' }), variant(['M'], { quantity: '2' })]
    const { variants, dropped } = reconcileVariants(
      [size('S', 'M'), colour('Red', 'Blue')],
      [size('S', 'M')],
      previous,
    )
    expect(variants.map((v) => [v.optionValues.join(' / '), v.id, v.quantity])).toEqual([
      ['S / Red', 'id-S', '4'],
      ['S / Blue', undefined, '0'],
      ['M / Red', 'id-M', '2'],
      ['M / Blue', undefined, '0'],
    ])
    expect(dropped).toEqual([])
  })

  it('collapses rows onto the remaining option when an option is removed', () => {
    const before = [size('S', 'M'), colour('Red', 'Blue')]
    const previous = [
      variant(['S', 'Red']),
      variant(['S', 'Blue'], { quantity: '3' }),
      variant(['M', 'Red']),
      variant(['M', 'Blue']),
    ]
    const { variants, dropped } = reconcileVariants([size('S', 'M')], before, previous)
    expect(variants.map((v) => v.id)).toEqual(['id-S-Red', 'id-M-Red'])
    expect(dropped.map((v) => v.id)).toEqual(['id-S-Blue', 'id-M-Blue'])
    expect(stockOf(dropped)).toBe(3)
  })

  it('keeps rows by title across two options', () => {
    const before = [size('S', 'M'), colour('Red')]
    const previous = [variant(['S', 'Red'], { price: '100' }), variant(['M', 'Red'])]
    const { variants } = reconcileVariants(
      [size('S', 'M'), colour('Red', 'Blue')],
      before,
      previous,
    )
    expect(variants).toHaveLength(4)
    const sRed = variants.find((v) => v.optionValues.join('/') === 'S/Red')
    expect(sRed?.id).toBe('id-S-Red')
    expect(sRed?.price).toBe('100')
  })

  it('leaves the matrix alone while a new option has no values yet', () => {
    const previous = [variant(['S']), variant(['M'])]
    const { variants, dropped } = reconcileVariants(
      [size('S', 'M'), { name: 'Colour', values: [] }],
      [size('S', 'M')],
      previous,
    )
    expect(variants.map((v) => v.id)).toEqual(['id-S', 'id-M'])
    expect(dropped).toEqual([])
  })

  it('survives renaming an option', () => {
    const previous = [variant(['S']), variant(['M'])]
    const { variants } = reconcileVariants(
      [{ name: 'Sizes', values: ['S', 'M'] }],
      [size('S', 'M')],
      previous,
    )
    expect(variants.map((v) => v.id)).toEqual(['id-S', 'id-M'])
  })

  it('back to a single default variant when the last option goes', () => {
    const previous = [variant(['S']), variant(['M'], { quantity: '1' })]
    const { variants, dropped } = reconcileVariants([], [size('S', 'M')], previous)
    expect(variants.map((v) => [v.optionValues, v.id])).toEqual([[[], 'id-S']])
    expect(stockOf(dropped)).toBe(1)
  })

  it('a brand-new value inherits price/tax/tracking defaults from an existing row', () => {
    const previous = [variant(['S'], { price: '150', taxable: false, trackInventory: false })]
    const { variants } = reconcileVariants([size('S', 'M')], [size('S')], previous)
    const m = variants.find((v) => v.optionValues[0] === 'M')
    expect(m?.price).toBe('150')
    expect(m?.taxable).toBe(false)
    expect(m?.trackInventory).toBe(false)
  })
})

describe('matrixOptions', () => {
  it('ignores options with no non-blank values', () => {
    expect(matrixOptions([size('S'), colour(' ')]).map((o) => o.name)).toEqual(['Size'])
  })
})

describe('stockOf', () => {
  it('sums tracked quantities only', () => {
    expect(
      stockOf([
        variant(['S'], { quantity: '5' }),
        variant(['M'], { quantity: '2', trackInventory: false }),
        variant(['L'], { quantity: '' }),
      ]),
    ).toBe(5)
  })
})

describe('formErrors', () => {
  it('asks for a value on an option that has none', () => {
    const form = { ...emptyForm(), title: 'Tee', options: [{ name: 'Colour', values: [] }] }
    expect(formErrors(productFormContent, form).variants).toBe('Add at least one value to Colour')
  })
})

describe('suggestSku', () => {
  it('joins the title and option values, uppercased and hyphenated', () => {
    expect(suggestSku('Classic T-Shirt', ['Red', 'M'])).toBe('CLASSIC-T-SHIRT-RED-M')
  })

  it('drops accents and punctuation', () => {
    expect(suggestSku('Café Déjà Vu', [])).toBe('CAFE-DEJA-VU')
  })

  it('works with no option values', () => {
    expect(suggestSku('Gift Card', [])).toBe('GIFT-CARD')
  })
})

describe('fromProduct', () => {
  it('gives a product with no variants one empty row so the editor can render', () => {
    const imported = {
      title: 'Historical item',
      description: null,
      status: 'archived',
      tags: [],
      handle: 'historical-item',
      options: [],
      variants: [],
      images: [],
    } as unknown as LoadedProduct
    const form = fromProduct(imported)
    expect(form.variants).toHaveLength(1)
    expect(form.variants[0]?.optionValues).toEqual([])
  })
})

describe('a product without a price (#913)', () => {
  const titled = (price: string) => ({
    ...emptyForm(),
    title: 'Pre-listed pad',
    status: 'active' as const,
    variants: [variant([], { price })],
  })

  it('saves with the price left blank, draft or active, and sends no price', () => {
    expect(formErrors(productFormContent, titled(''))).toEqual({})
    expect(toWrite(titled('')).variants[0]?.pricePaise).toBeNull()
    expect(toWrite(titled('499')).variants[0]?.pricePaise).toBe(49900)
  })

  it('still stops a price that is typed but not a number', () => {
    expect(formErrors(productFormContent, titled('abc')).variants).toMatch(/as a number/)
  })
})

describe("a variant's own pre-order limit", () => {
  const titled = (preorderLimit: string) => ({
    ...emptyForm(),
    title: 'Glasspad',
    preorderEnabled: true,
    preorderLimit: '20',
    variants: [variant(['Black'], { preorderLimit }), variant(['White'])],
  })

  it('sends the typed limit, and null for a blank one (use the product limit)', () => {
    const write = toWrite(titled('5'))
    expect(write.variants.map((v) => v.preorderLimit)).toEqual([5, null])
    expect(write.preorderLimit).toBe(20)
  })

  it('reads the variant limit back from the loaded product', () => {
    const loaded = {
      title: 'Glasspad',
      description: null,
      status: 'active',
      tags: [],
      handle: 'glasspad',
      options: [],
      images: [],
      variants: [
        { id: 'v1', optionValues: [], preorderAllowed: true, preorderLimit: 3, mediaIds: [] },
        { id: 'v2', optionValues: [], preorderAllowed: true, preorderLimit: null, mediaIds: [] },
      ],
    } as unknown as LoadedProduct
    expect(fromProduct(loaded).variants.map((v) => v.preorderLimit)).toEqual(['3', ''])
  })

  it('accepts a whole number of 1 or more, or blank; stops anything else', () => {
    expect(['', ' ', '1', '25', '1000000'].every(validVariantLimit)).toBe(true)
    expect(['0', '-2', '1.5', 'abc', '1000001'].some(validVariantLimit)).toBe(false)
    expect(formErrors(productFormContent, titled('5'))).toEqual({})
    expect(formErrors(productFormContent, titled('0')).variants).toMatch(
      /pre-order limit for Black/,
    )
  })

  it("shows the product's limit, no limit, or the campaign's in the placeholder", () => {
    expect(inheritedPreorderLimit(titled(''))).toEqual({ from: 'product', limit: 20 })
    expect(inheritedPreorderLimit({ ...titled(''), preorderLimit: '' })).toEqual({
      from: 'product',
      limit: null,
    })
    const inCampaign = { ...titled(''), preorderCampaignId: 'c1', preorderOwn: [] }
    expect(inheritedPreorderLimit(inCampaign)).toEqual({ from: 'campaign' })
    expect(inheritedPreorderLimit({ ...inCampaign, preorderOwn: ['limit'] })).toEqual({
      from: 'product',
      limit: 20,
    })
  })

  it('offers the field only while the product takes pre-orders', () => {
    expect(variantPreorderContext(titled('')).on).toBe(true)
    expect(variantPreorderContext({ ...titled(''), preorderEnabled: false }).on).toBe(false)
    expect(
      variantPreorderContext({ ...titled(''), preorderEnabled: false, preorderCampaignId: 'c1' })
        .on,
    ).toBe(true)
  })
})
