/** What `products.bulkEditSheet` returns for one variant. */
export type SheetRow = {
  variantId: string
  productId: string
  title: string
  status: 'draft' | 'active' | 'archived'
  vendor: string | null
  productType: string | null
  tags: string[]
  handle: string
  descriptionText: string
  seoTitle: string | null
  seoDescription: string | null
  featured: boolean
  taxIncluded: boolean
  templateSuffix: string | null
  collectionIds: string[]
  variantTitle: string
  /** Null: listed without a price yet (#913). */
  pricePaise: number | null
  mrpPaise: number | null
  costPaise: number | null
  sku: string | null
  barcode: string | null
  weightGrams: number | null
  hsCode: string | null
  gstRatePercent: number | null
  trackInventory: boolean
  countryOfOrigin: string | null
  packageLengthCm: number | null
  packageWidthCm: number | null
  packageHeightCm: number | null
  stock: Record<string, number>
}

/** A manual collection a product can be put in. */
export type SheetCollection = { id: string; title: string }

/** One grid row: every cell is the text the person sees and types, rupees not paise. */
export type GridRow = FixedCells & { [stockCell: `stock:${string}`]: string }

type FixedCells = {
  variantId: string
  productId: string
  variantTitle: string
  title: string
  status: string
  vendor: string
  productType: string
  tags: string
  handle: string
  description: string
  seoTitle: string
  seoDescription: string
  collections: string
  featured: string
  taxIncluded: string
  templateSuffix: string
  trackInventory: string
  countryOfOrigin: string
  packageLength: string
  packageWidth: string
  packageHeight: string
  price: string
  mrp: string
  cost: string
  sku: string
  barcode: string
  weight: string
  hsCode: string
  gst: string
}

export const PRODUCT_COLUMNS = [
  'title',
  'status',
  'handle',
  'vendor',
  'productType',
  'collections',
  'tags',
  'seoTitle',
  'seoDescription',
  'featured',
  'taxIncluded',
  'templateSuffix',
] as const
export const VARIANT_COLUMNS = [
  'price',
  'mrp',
  'cost',
  'sku',
  'barcode',
  'weight',
  'hsCode',
  'gst',
  'trackInventory',
  'countryOfOrigin',
  'packageLength',
  'packageWidth',
  'packageHeight',
] as const
/** Yes/No cells, picked from a list. */
export const BOOLEAN_COLUMNS = ['featured', 'taxIncluded', 'trackInventory'] as const
export type ProductColumn = (typeof PRODUCT_COLUMNS)[number]
export type VariantColumn = (typeof VARIANT_COLUMNS)[number]
export const STATUSES = ['draft', 'active', 'archived'] as const

/** A column key: a plain cell, or `stock:<locationId>`. */
export const STOCK_PREFIX = 'stock:'

/** The server's name for a cell, so its per-row errors land on the right column. */
const SERVER_FIELD: Record<string, string> = {
  pricePaise: 'price',
  mrpPaise: 'mrp',
  costPaise: 'cost',
  weightGrams: 'weight',
  gstRatePercent: 'gst',
  collectionIds: 'collections',
  packageLengthCm: 'packageLength',
  packageWidthCm: 'packageWidth',
  packageHeightCm: 'packageHeight',
}
export const gridColumnOf = (serverField: string) => SERVER_FIELD[serverField] ?? serverField

const yesNo = (v: boolean) => (v ? 'yes' : 'no')
const rupees = (paise: number | null) => (paise === null ? '' : String(paise / 100))
const text = (v: string | null) => v ?? ''
const num = (v: number | null) => (v === null ? '' : String(v))

export function toGridRow(
  r: SheetRow,
  locationIds: string[],
  collections: SheetCollection[] = [],
): GridRow {
  const titles = new Map(collections.map((c) => [c.id, c.title]))
  return {
    variantId: r.variantId,
    productId: r.productId,
    variantTitle: r.variantTitle,
    title: r.title,
    status: r.status,
    vendor: text(r.vendor),
    productType: text(r.productType),
    tags: r.tags.join(', '),
    handle: r.handle,
    description: r.descriptionText,
    seoTitle: text(r.seoTitle),
    seoDescription: text(r.seoDescription),
    collections: r.collectionIds.map((id) => titles.get(id) ?? id).join(', '),
    featured: yesNo(r.featured),
    taxIncluded: yesNo(r.taxIncluded),
    templateSuffix: text(r.templateSuffix),
    trackInventory: yesNo(r.trackInventory),
    countryOfOrigin: text(r.countryOfOrigin),
    packageLength: num(r.packageLengthCm),
    packageWidth: num(r.packageWidthCm),
    packageHeight: num(r.packageHeightCm),
    price: rupees(r.pricePaise),
    mrp: rupees(r.mrpPaise),
    cost: rupees(r.costPaise),
    sku: text(r.sku),
    barcode: text(r.barcode),
    weight: num(r.weightGrams),
    hsCode: text(r.hsCode),
    gst: num(r.gstRatePercent),
    /* A stock cell is a plain key of its own, `stock:<locationId>`, so the grid reads it like any other. */
    ...Object.fromEntries(
      locationIds.map((loc) => [`${STOCK_PREFIX}${loc}`, String(r.stock[loc] ?? 0)]),
    ),
  }
}

/** Rupee text to paise; null for blank, NaN for junk. */
export function parsePaise(value: string): number | null {
  const v = value.replace(/[₹,\s]/g, '')
  if (v === '') return null
  const n = Number(v)
  if (!Number.isFinite(n) || n < 0) return Number.NaN
  return Math.round(n * 100)
}

/** Whole-number text; null for blank, NaN for junk. */
export function parseWhole(value: string): number | null {
  const v = value.replace(/[,\s]/g, '')
  if (v === '') return null
  const n = Number(v)
  return Number.isInteger(n) && n >= 0 ? n : Number.NaN
}

export const parseTags = (value: string) => [
  ...new Set(
    value
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean),
  ),
]

/** The value of one cell, for dirty checks, copy and fill. */
export const cellValue = (row: GridRow, key: string): string =>
  String((row as Record<string, unknown>)[key] ?? '')

export const withCell = (row: GridRow, key: string, value: string): GridRow => ({
  ...row,
  [key]: value,
})

/** Editing a product cell on one variant row sets it on every row of that product. */
export function syncProductCell(rows: GridRow[], source: GridRow, key: string): GridRow[] {
  if (!(PRODUCT_COLUMNS as readonly string[]).includes(key)) return rows
  return rows.map((r) =>
    r.productId === source.productId ? withCell(r, key, cellValue(source, key)) : r,
  )
}

export const isDirty = (row: GridRow, base: GridRow | undefined, key: string) =>
  base !== undefined && cellValue(row, key) !== cellValue(base, key)

/** Cell keys that differ from the loaded sheet, across all rows. */
export function dirtyCount(rows: GridRow[], base: Map<string, GridRow>, keys: string[]): number {
  let n = 0
  for (const row of rows) for (const k of keys) if (isDirty(row, base.get(row.variantId), k)) n += 1
  return n
}

export type CellErrors = Map<string, string>
/** `<variantId>|<column>` */
export const errorKey = (variantId: string, column: string) => `${variantId}|${column}`

/** Yes/No text from a pasted or typed value; anything else is left as typed, to be flagged. */
export function parseYesNo(value: string): string {
  const v = value.trim().toLowerCase()
  if (['yes', 'y', 'true', '1'].includes(v)) return 'yes'
  if (['no', 'n', 'false', '0'].includes(v)) return 'no'
  return value.trim()
}

/**
 * A pasted block of tab-separated text (from Sheets or Excel) laid over the grid from the
 * active cell: down the rows and across the columns, stopping at the last of each.
 */
export function applyPaste(
  rows: GridRow[],
  keys: string[],
  start: { rowIdx: number; colIdx: number },
  pasted: string,
  editable: (key: string) => boolean,
): GridRow[] {
  const lines = pasted.replace(/\r\n?/g, '\n').replace(/\n$/, '').split('\n')
  let next = rows
  lines.forEach((line, dy) => {
    const target = next[start.rowIdx + dy]
    if (!target) return
    let row = target
    line.split('\t').forEach((value, dx) => {
      const key = keys[start.colIdx + dx]
      if (key && editable(key)) {
        const isBool = (BOOLEAN_COLUMNS as readonly string[]).includes(key)
        row = withCell(row, key, isBool ? parseYesNo(value) : value.trim())
      }
    })
    next = next.map((r) => (r.variantId === row.variantId ? row : r))
    for (const key of PRODUCT_COLUMNS) next = syncProductCell(next, row, key)
  })
  return next
}

/** Collection names (comma-separated) to ids; names no manual collection has come back as `unknown`. */
export function parseCollections(value: string, collections: SheetCollection[]) {
  const byName = new Map(collections.map((c) => [c.title.trim().toLowerCase(), c.id]))
  const ids: string[] = []
  const unknown: string[] = []
  for (const name of parseTags(value)) {
    const id = byName.get(name.toLowerCase())
    if (id) {
      if (!ids.includes(id)) ids.push(id)
    } else unknown.push(name)
  }
  return { ids, unknown }
}
