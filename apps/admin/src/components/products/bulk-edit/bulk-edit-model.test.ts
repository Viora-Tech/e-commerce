import { describe, expect, it } from 'vitest'
import {
  applyPaste,
  type GridRow,
  parsePaise,
  parseWhole,
  type SheetCollection,
  type SheetRow,
  syncProductCell,
  toGridRow,
} from './bulk-edit-model'
import { toBulkRows } from './bulk-edit-payload'
import { validateRows } from './bulk-edit-validate'

const LOC = '00000000-0000-4000-8000-000000000001'
const SALE: SheetCollection = { id: '00000000-0000-4000-8000-0000000000c1', title: 'Sale' }

const sheetRow = (n: number, patch: Partial<SheetRow> = {}): SheetRow => ({
  variantId: `00000000-0000-4000-8000-00000000010${n}`,
  productId: '00000000-0000-4000-8000-000000000a01',
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

const rows = (): GridRow[] => [sheetRow(1), sheetRow(2)].map((r) => toGridRow(r, [LOC], [SALE]))
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
    expect(toBulkRows(edited, base, [LOC], [SALE])).toEqual([
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
    const errors = validateRows(list, {
      locationIds: [LOC],
      collections: [SALE],
      base: baseOf(rows()),
    })
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

  it('maps the new product and variant cells to the API patch', () => {
    const base = baseOf(rows())
    const edited = rows().map((r, i) =>
      i === 0
        ? {
            ...r,
            handle: 'pad-2',
            collections: 'sale',
            featured: 'yes',
            seoTitle: ' Pad ',
            trackInventory: 'no',
            countryOfOrigin: 'in',
            packageLength: '10',
            packageWidth: '5',
            packageHeight: '2',
          }
        : r,
    )
    expect(toBulkRows(edited, base, [LOC], [SALE])).toEqual([
      {
        variantId: sheetRow(1).variantId,
        product: { handle: 'pad-2', collectionIds: [SALE.id], featured: true, seoTitle: 'Pad' },
        variant: {
          trackInventory: false,
          countryOfOrigin: 'IN',
          packageLengthCm: 10,
          packageWidthCm: 5,
          packageHeightCm: 2,
        },
      },
    ])
  })

  it('flags bad handles, collections, Yes/No cells and part-filled boxes', () => {
    const list = rows().map((r, i) =>
      i === 0
        ? { ...r, handle: 'Bad Handle', collections: 'Nope', featured: 'maybe', packageLength: '5' }
        : r,
    )
    const errors = validateRows(list, {
      locationIds: [LOC],
      collections: [SALE],
      base: baseOf(rows()),
    })
    const id1 = sheetRow(1).variantId
    expect(errors.get(`${id1}|handle`)).toBeDefined()
    expect(errors.get(`${id1}|collections`)).toMatch(/Nope/)
    expect(errors.get(`${id1}|featured`)).toBeDefined()
    expect(errors.get(`${id1}|packageWidth`)).toBeDefined()
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
