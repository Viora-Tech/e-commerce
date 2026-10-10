import { describe, expect, it } from 'vitest'
import {
  applyPaste,
  type GridRow,
  parsePaise,
  parseWhole,
  type SheetRow,
  syncProductCell,
  toBulkRows,
  toGridRow,
  validateRows,
} from './bulk-edit-model'

const LOC = '00000000-0000-4000-8000-000000000001'

const sheetRow = (n: number, patch: Partial<SheetRow> = {}): SheetRow => ({
  variantId: `00000000-0000-4000-8000-00000000010${n}`,
  productId: '00000000-0000-4000-8000-000000000a01',
  title: 'Pad',
  status: 'draft',
  vendor: null,
  productType: null,
  tags: [],
  variantTitle: `S${n}`,
  pricePaise: 100_000,
  mrpPaise: 120_000,
  costPaise: null,
  sku: `PAD-${n}`,
  barcode: null,
  weightGrams: null,
  hsCode: null,
  gstRatePercent: null,
  stock: { [LOC]: 5 },
  ...patch,
})

const rows = (): GridRow[] => [sheetRow(1), sheetRow(2)].map((r) => toGridRow(r, [LOC]))
const baseOf = (list: GridRow[]) => new Map(list.map((r) => [r.variantId, r]))

describe('bulk edit model', () => {
  it('reads rupees and whole numbers, blank as null, junk as NaN', () => {
    expect(parsePaise('₹1,299.50')).toBe(129_950)
    expect(parsePaise('')).toBeNull()
    expect(parsePaise('abc')).toBeNaN()
    expect(parseWhole('12')).toBe(12)
    expect(parseWhole('1.5')).toBeNaN()
  })

  it('sends only the cells that changed', () => {
    const base = baseOf(rows())
    const edited = rows().map((r, i) =>
      i === 0 ? { ...r, price: '900', vendor: ' Acme ', [`stock:${LOC}`]: '9' } : r,
    )
    expect(toBulkRows(edited, base, [LOC])).toEqual([
      {
        variantId: sheetRow(1).variantId,
        product: { vendor: 'Acme' },
        variant: { pricePaise: 90_000 },
        stock: { [LOC]: 9 },
      },
    ])
  })

  it('keeps a product cell the same on every variant of the product', () => {
    const list = rows()
    const edited = [{ ...(list[0] as GridRow), title: 'Pad 2' }, list[1] as GridRow]
    const synced = syncProductCell(edited, edited[0] as GridRow, 'title')
    expect(synced.map((r) => r.title)).toEqual(['Pad 2', 'Pad 2'])
    expect(syncProductCell(edited, edited[0] as GridRow, 'price')).toBe(edited)
  })

  it('flags the same mistakes the server does', () => {
    const list = rows().map((r, i) =>
      i === 0
        ? { ...r, price: '2000', hsCode: '12', gst: '99', sku: 'DUP', [`stock:${LOC}`]: '-1' }
        : { ...r, sku: 'dup', title: ' ' },
    )
    const errors = validateRows(list, [LOC])
    const id1 = sheetRow(1).variantId
    const id2 = sheetRow(2).variantId
    expect(errors.get(`${id1}|mrp`)).toMatch(/Compare-at/)
    expect(errors.get(`${id1}|hsCode`)).toMatch(/HSN/)
    expect(errors.get(`${id1}|gst`)).toBeDefined()
    expect(errors.get(`${id1}|stock:${LOC}`)).toBeDefined()
    expect(errors.get(`${id1}|sku`)).toBeDefined()
    expect(errors.get(`${id2}|sku`)).toBeDefined()
    expect(errors.get(`${id2}|title`)).toBeDefined()
  })

  it('lays a pasted block from the active cell, down and across', () => {
    const keys = ['title', 'variantTitle', 'status', 'vendor', 'productType', 'tags', 'price']
    const out = applyPaste(
      rows(),
      keys,
      { rowIdx: 0, colIdx: 3 },
      'Acme\tShoes\r\nBeta\tBoots\r\n',
      (k) => k !== 'variantTitle',
    )
    expect(out.map((r) => [r.vendor, r.productType])).toEqual([
      ['Beta', 'Boots'],
      ['Beta', 'Boots'],
    ])
  })
})
