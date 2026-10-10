import { type BulkEditRow, HS_CODE_PATTERN } from '@commerce/core/catalog'

/** What `products.bulkEditSheet` returns for one variant. */
export type SheetRow = {
  variantId: string
  productId: string
  title: string
  status: 'draft' | 'active' | 'archived'
  vendor: string | null
  productType: string | null
  tags: string[]
  variantTitle: string
  pricePaise: number
  mrpPaise: number | null
  costPaise: number | null
  sku: string | null
  barcode: string | null
  weightGrams: number | null
  hsCode: string | null
  gstRatePercent: number | null
  stock: Record<string, number>
}

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
  price: string
  mrp: string
  cost: string
  sku: string
  barcode: string
  weight: string
  hsCode: string
  gst: string
}

export const PRODUCT_COLUMNS = ['title', 'status', 'vendor', 'productType', 'tags'] as const
export const VARIANT_COLUMNS = [
  'price',
  'mrp',
  'cost',
  'sku',
  'barcode',
  'weight',
  'hsCode',
  'gst',
] as const
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
}
export const gridColumnOf = (serverField: string) => SERVER_FIELD[serverField] ?? serverField

const rupees = (paise: number | null) => (paise === null ? '' : String(paise / 100))
const text = (v: string | null) => v ?? ''
const num = (v: number | null) => (v === null ? '' : String(v))

export function toGridRow(r: SheetRow, locationIds: string[]): GridRow {
  return {
    variantId: r.variantId,
    productId: r.productId,
    variantTitle: r.variantTitle,
    title: r.title,
    status: r.status,
    vendor: text(r.vendor),
    productType: text(r.productType),
    tags: r.tags.join(', '),
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

/** The rules the server also enforces, so mistakes show before Save. */
export function validateRows(rows: GridRow[], locationIds: string[]): CellErrors {
  const errors: CellErrors = new Map()
  const seenSku = new Map<string, string>()
  for (const r of rows) {
    const bad = (column: string, message: string) =>
      errors.set(errorKey(r.variantId, column), message)
    if (!r.title.trim()) bad('title', 'Title is required')
    if (!(STATUSES as readonly string[]).includes(r.status))
      bad('status', 'Pick draft, active or archived')
    const price = parsePaise(r.price)
    if (price === null || Number.isNaN(price)) bad('price', 'Enter a price')
    const mrp = parsePaise(r.mrp)
    if (Number.isNaN(mrp)) bad('mrp', 'Enter an amount')
    else if (mrp !== null && price !== null && !Number.isNaN(price) && mrp < price) {
      bad('mrp', 'Compare-at must not be below the price')
    }
    if (Number.isNaN(parsePaise(r.cost))) bad('cost', 'Enter an amount')
    if (Number.isNaN(parseWhole(r.weight))) bad('weight', 'Whole grams')
    if (r.hsCode.trim() && !HS_CODE_PATTERN.test(r.hsCode.trim()))
      bad('hsCode', 'HSN is 4 to 8 digits')
    const gst = parseWhole(r.gst)
    if (Number.isNaN(gst) || (gst !== null && gst > 40)) bad('gst', 'A rate from 0 to 40')
    const sku = r.sku.trim().toLowerCase()
    if (sku) {
      const first = seenSku.get(sku)
      if (first) {
        bad('sku', 'This SKU is used twice')
        errors.set(errorKey(first, 'sku'), 'This SKU is used twice')
      } else seenSku.set(sku, r.variantId)
    }
    for (const loc of locationIds) {
      if (Number.isNaN(parseWhole(cellValue(r, `${STOCK_PREFIX}${loc}`))))
        bad(`${STOCK_PREFIX}${loc}`, 'Whole number')
    }
  }
  return errors
}

/**
 * Only the cells that changed, as the API's rows. An emptied optional cell sends null; a
 * required one that is empty is a validation error and never gets here.
 */
export function toBulkRows(
  rows: GridRow[],
  base: Map<string, GridRow>,
  locationIds: string[],
): BulkEditRow[] {
  const out: BulkEditRow[] = []
  for (const r of rows) {
    const b = base.get(r.variantId)
    if (!b) continue
    const changed = (k: string) => isDirty(r, b, k)
    const row: BulkEditRow = { variantId: r.variantId }
    const product: NonNullable<BulkEditRow['product']> = {}
    if (changed('title')) product.title = r.title.trim()
    if (changed('status')) product.status = r.status as (typeof STATUSES)[number]
    if (changed('vendor')) product.vendor = r.vendor.trim() || null
    if (changed('productType')) product.productType = r.productType.trim() || null
    if (changed('tags')) product.tags = parseTags(r.tags)
    const variant: NonNullable<BulkEditRow['variant']> = {}
    if (changed('price')) variant.pricePaise = parsePaise(r.price) ?? 0
    if (changed('mrp')) variant.mrpPaise = parsePaise(r.mrp)
    if (changed('cost')) variant.costPaise = parsePaise(r.cost)
    if (changed('sku')) variant.sku = r.sku.trim() || null
    if (changed('barcode')) variant.barcode = r.barcode.trim() || null
    if (changed('weight')) variant.weightGrams = parseWhole(r.weight)
    if (changed('hsCode')) variant.hsCode = r.hsCode.trim() || null
    if (changed('gst')) variant.gstRatePercent = parseWhole(r.gst)
    const stock: Record<string, number> = {}
    for (const loc of locationIds) {
      if (changed(`${STOCK_PREFIX}${loc}`))
        stock[loc] = parseWhole(cellValue(r, `${STOCK_PREFIX}${loc}`)) ?? 0
    }
    if (Object.keys(product).length) row.product = product
    if (Object.keys(variant).length) row.variant = variant
    if (Object.keys(stock).length) row.stock = stock
    if (row.product || row.variant || row.stock) out.push(row)
  }
  return out
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
      if (key && editable(key)) row = withCell(row, key, value.trim())
    })
    next = next.map((r) => (r.variantId === row.variantId ? row : r))
    for (const key of PRODUCT_COLUMNS) next = syncProductCell(next, row, key)
  })
  return next
}
