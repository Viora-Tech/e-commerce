import { HS_CODE_PATTERN } from '@commerce/core/catalog'
import {
  BOOLEAN_COLUMNS,
  type CellErrors,
  cellValue,
  errorKey,
  type GridRow,
  isDirty,
  parseCollections,
  parsePaise,
  parseWhole,
  type SheetCollection,
  STATUSES,
  STOCK_PREFIX,
} from './bulk-edit-model'

type ValidateContext = {
  locationIds: string[]
  collections: SheetCollection[]
  /** The sheet as loaded, so a legacy value nobody touched is not flagged. */
  base: Map<string, GridRow>
}

const HANDLE_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const TEMPLATE_PATTERN = /^[a-z0-9-]{0,40}$/
const PACKAGE_COLUMNS = ['packageLength', 'packageWidth', 'packageHeight'] as const
const CM_MAX = 200

/** The rules the server also enforces, so mistakes show before Save. */
export function validateRows(rows: GridRow[], ctx: ValidateContext): CellErrors {
  const errors: CellErrors = new Map()
  const seenSku = new Map<string, string>()
  const seenHandle = new Map<string, GridRow>()
  for (const r of rows) {
    const bad = (column: string, message: string) =>
      errors.set(errorKey(r.variantId, column), message)
    if (!r.title.trim()) bad('title', 'Title is required')
    if (!(STATUSES as readonly string[]).includes(r.status))
      bad('status', 'Pick draft, active or archived')
    validateHandle(r, ctx, seenHandle, bad)
    if (r.seoTitle.trim().length > 70) bad('seoTitle', 'At most 70 characters')
    if (r.seoDescription.trim().length > 320) bad('seoDescription', 'At most 320 characters')
    if (!TEMPLATE_PATTERN.test(r.templateSuffix.trim()))
      bad('templateSuffix', 'Lowercase letters, numbers and hyphens')
    const { unknown } = parseCollections(r.collections, ctx.collections)
    if (unknown.length > 0) bad('collections', `No manual collection named ${unknown.join(', ')}`)
    for (const key of BOOLEAN_COLUMNS) {
      if (!['yes', 'no'].includes(cellValue(r, key))) bad(key, 'Pick Yes or No')
    }
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
    if (r.countryOfOrigin.trim() && !/^[A-Za-z]{2}$/.test(r.countryOfOrigin.trim()))
      bad('countryOfOrigin', 'A 2-letter country code, like IN')
    validatePackage(r, bad)
    const sku = r.sku.trim().toLowerCase()
    if (sku) {
      const first = seenSku.get(sku)
      if (first) {
        bad('sku', 'This SKU is used twice')
        errors.set(errorKey(first, 'sku'), 'This SKU is used twice')
      } else seenSku.set(sku, r.variantId)
    }
    for (const loc of ctx.locationIds) {
      if (Number.isNaN(parseWhole(cellValue(r, `${STOCK_PREFIX}${loc}`))))
        bad(`${STOCK_PREFIX}${loc}`, 'Whole number')
    }
  }
  return errors
}

/** A handle is a slug, and no two products of the sheet may share one. */
function validateHandle(
  r: GridRow,
  ctx: ValidateContext,
  seen: Map<string, GridRow>,
  bad: (column: string, message: string) => void,
) {
  const handle = r.handle.trim()
  if (isDirty(r, ctx.base.get(r.variantId), 'handle')) {
    if (!handle) bad('handle', 'Handle is required')
    else if (!HANDLE_PATTERN.test(handle)) bad('handle', 'Lowercase letters, numbers and hyphens')
  }
  const other = seen.get(handle)
  if (handle && other && other.productId !== r.productId) bad('handle', 'This handle is used twice')
  else if (handle) seen.set(handle, r)
}

/** Custom box sizes are whole centimetres, and all three or none. */
function validatePackage(r: GridRow, bad: (column: string, message: string) => void) {
  const values = PACKAGE_COLUMNS.map((k) => parseWhole(cellValue(r, k)))
  PACKAGE_COLUMNS.forEach((k, i) => {
    const v = values[i]
    if (v === undefined) return
    if (Number.isNaN(v) || (v !== null && (v < 1 || v > CM_MAX))) bad(k, `Whole cm, 1 to ${CM_MAX}`)
  })
  const set = values.filter((v) => v !== null).length
  if (set > 0 && set < PACKAGE_COLUMNS.length) {
    for (const [i, k] of PACKAGE_COLUMNS.entries()) {
      if (values[i] === null) bad(k, 'Set length, width and height together')
    }
  }
}
