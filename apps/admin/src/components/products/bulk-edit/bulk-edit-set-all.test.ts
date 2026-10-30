import { describe, expect, it } from 'vitest'
import { type GridRow, type SheetRow, toGridRow } from './bulk-edit-model'
import { adjustMinor, adjustMoneyText, applyToRows, parseChangeValue } from './bulk-edit-set-all'
import {
  applyViewChanges,
  buildView,
  pasteIntoView,
  selectedVariantIds,
  setViewCell,
} from './bulk-edit-view'

const LOC = '00000000-0000-4000-8000-000000000001'
const PAD = '00000000-0000-4000-8000-000000000a01'
const MAT = '00000000-0000-4000-8000-000000000a02'

const sheetRow = (n: number, patch: Partial<SheetRow> = {}): SheetRow => ({
  variantId: `00000000-0000-4000-8000-00000000010${n}`,
  productId: PAD,
  title: 'Pad',
  status: 'draft',
  vendor: null,
  productType: null,
  tags: [],
  handle: 'pad',
  descriptionText: '',
  seoTitle: null,
  seoDescription: null,
  featured: false,
  taxIncluded: true,
  templateSuffix: null,
  collectionIds: [],
  variantTitle: `S${n}`,
  pricePaise: 100_000,
  mrpPaise: 120_000,
  costPaise: null,
  sku: `PAD-${n}`,
  barcode: null,
  weightGrams: null,
  hsCode: null,
  gstRatePercent: null,
  trackInventory: true,
  countryOfOrigin: null,
  packageLengthCm: null,
  packageWidthCm: null,
  packageHeightCm: null,
  stock: { [LOC]: 5 },
  ...patch,
})

/** Pad has two variants (₹1,000 and ₹1,500); Mat has one. */
const rows = (): GridRow[] =>
  [
    sheetRow(1),
    sheetRow(2, { pricePaise: 150_000, mrpPaise: null }),
    sheetRow(3, { productId: MAT, title: 'Mat', handle: 'mat', variantTitle: 'Default' }),
  ].map((r) => toGridRow(r, [LOC]))

describe('bulk price change', () => {
  it('reads amounts in rupees and percentages, refusing junk', () => {
    expect(parseChangeValue('increaseAmount', '₹1,250.50')).toBe(125_050)
    expect(parseChangeValue('increaseAmount', '0')).toBeNull()
    expect(parseChangeValue('setAmount', '0')).toBe(0)
    expect(parseChangeValue('increasePercent', '12.5%')).toBe(12.5)
    expect(parseChangeValue('decreasePercent', '120')).toBeNull()
    expect(parseChangeValue('increaseAmount', 'abc')).toBeNull()
  })

  it('moves amounts by an amount or a percentage, rounded, never below zero', () => {
    expect(adjustMinor(100_000, 'increaseAmount', 5_000)).toBe(105_000)
    expect(adjustMinor(100_000, 'decreaseAmount', 150_000)).toBe(0)
    expect(adjustMinor(99_900, 'increasePercent', 10)).toBe(109_890)
    expect(adjustMinor(99_999, 'decreasePercent', 15)).toBe(84_999)
    expect(adjustMinor(100_000, 'decreasePercent', 100)).toBe(0)
    expect(adjustMinor(100_000, 'setAmount', 49_900)).toBe(49_900)
  })

  it('keeps blank prices blank unless one is set', () => {
    expect(adjustMoneyText('', 'increasePercent', 10)).toBe('')
    expect(adjustMoneyText('', 'setAmount', 49_900)).toBe('499')
    expect(adjustMoneyText('999.5', 'increaseAmount', 50)).toBe('1000')
  })

  it('changes every row or only the ticked variants', () => {
    const all = applyToRows(rows(), { key: 'price', action: 'increasePercent', value: '10' }, null)
    expect(all.map((r) => r.price)).toEqual(['1100', '1650', '1100'])
    const first = rows()[0] as GridRow
    const one = applyToRows(
      rows(),
      { key: 'price', action: 'decreaseAmount', value: '100' },
      new Set([first.variantId]),
    )
    expect(one.map((r) => r.price)).toEqual(['900', '1500', '1000'])
  })

  it('moves price and compare-at together and clears compare-at', () => {
    const both = applyToRows(
      rows(),
      { key: 'priceAndMrp', action: 'decreasePercent', value: '50' },
      null,
    )
    expect(both.map((r) => [r.price, r.mrp])).toEqual([
      ['500', '600'],
      ['750', ''],
      ['500', '600'],
    ])
    const cleared = applyToRows(rows(), { key: 'mrp', action: 'clearAmount', value: '' }, null)
    expect(cleared.every((r) => r.mrp === '')).toBe(true)
  })

  it('sets a product cell on every variant of a ticked product', () => {
    const first = rows()[0] as GridRow
    const next = applyToRows(
      rows(),
      { key: 'status', action: 'setStatus', value: 'active' },
      new Set([first.variantId]),
    )
    expect(next.map((r) => r.status)).toEqual(['active', 'active', 'draft'])
  })
})

describe('one row per product', () => {
  it('shows a product row per product and its variants only when expanded', () => {
    const collapsed = buildView(rows(), new Set())
    expect(collapsed.map((r) => r.viewKind)).toEqual(['product', 'single'])
    const product = collapsed[0]
    expect(product?.mixedKeys).toContain('price')
    expect(product?.price).toBe('')
    expect(product?.cost).toBe('')
    expect(product?.[`stock:${LOC}`]).toBe('10')
    const open = buildView(rows(), new Set([PAD]))
    expect(open.map((r) => r.viewKind)).toEqual(['product', 'variant', 'variant', 'single'])
  })

  it('types into a product row to set every variant, a variant row to set one', () => {
    const [product] = buildView(rows(), new Set())
    if (!product) throw new Error('no product row')
    const priced = setViewCell(rows(), product, 'price', '799')
    expect(priced.map((r) => r.price)).toEqual(['799', '799', '1000'])
    const variant = buildView(rows(), new Set([PAD]))[2]
    if (!variant) throw new Error('no variant row')
    expect(setViewCell(rows(), variant, 'sku', 'X').map((r) => r.sku)).toEqual([
      'PAD-1',
      'X',
      'PAD-3',
    ])
    // A variant row does not edit product cells.
    expect(setViewCell(rows(), variant, 'title', 'New')).toEqual(rows())
  })

  it('ignores a mixed cell the grid hands back unchanged', () => {
    const before = buildView(rows(), new Set())
    const after = before.map((r) => ({ ...r }))
    expect(applyViewChanges(rows(), before, after, [0], 'price')).toEqual(rows())
  })

  it('pastes down the shown rows and expands ticked product rows to their variants', () => {
    const view = buildView(rows(), new Set())
    const start = { rowIdx: 0, colIdx: 1 }
    const pasted = pasteIntoView(rows(), view, ['title', 'price'], start, '10\n20')
    expect(pasted.map((r) => r.price)).toEqual(['10', '10', '20'])
    expect(selectedVariantIds(view, new Set([`product:${PAD}`])).length).toBe(2)
  })
})
