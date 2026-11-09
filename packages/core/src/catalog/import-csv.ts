/**
 * Shopify product CSV → our product write shape.
 *
 * Shopify exports one row per variant and repeats the handle, leaving every
 * product column blank after the first row of a group. Image rows repeat the
 * handle with nothing but `Image Src`. We fold a group back into one product,
 * so the parser is pure and the caller decides whether to write anything.
 */

import { parseRupees } from '@commerce/money'
import type { ProductStatus } from './schemas'
import { variantTitle } from './variants'

export type ImportVariant = {
  optionValues: string[]
  sku: string | null
  barcode: string | null
  pricePaise: number
  mrpPaise: number | null
  costPaise: number | null
  taxable: boolean
  trackInventory: boolean
  /** "Variant Requires Shipping"; undefined when the file leaves it blank or has no column. */
  requiresShipping?: boolean | undefined
  weightGrams: number | null
  onHand: number
}

export type ImportProduct = {
  handle: string
  title: string
  descriptionHtml: string | null
  vendor: string | null
  productType: string | null
  tags: string[]
  status: ProductStatus
  seoTitle: string | null
  seoDescription: string | null
  optionNames: string[]
  variants: ImportVariant[]
  imageUrls: string[]
}

export type ImportIssue = { row: number; handle: string | null; message: string }

export type ParsedImport = {
  products: ImportProduct[]
  issues: ImportIssue[]
  /** Columns in the file we do not read, so the dry run can say what is ignored. */
  ignoredColumns: string[]
}

/** Header names we understand; anything else is reported as ignored. */
const KNOWN_COLUMNS = new Set([
  'handle',
  'title',
  'body (html)',
  'body',
  'vendor',
  'type',
  'product type',
  'tags',
  'published',
  'status',
  'option1 name',
  'option1 value',
  'option2 name',
  'option2 value',
  'option3 name',
  'option3 value',
  'variant sku',
  'variant grams',
  'variant weight',
  'variant inventory qty',
  'variant inventory tracker',
  'variant inventory policy',
  'variant price',
  'variant compare at price',
  'variant cost',
  'cost per item',
  'variant barcode',
  'variant taxable',
  'variant requires shipping',
  'image src',
  'seo title',
  'seo description',
])

const MAX_OPTIONS = 3
const MAX_VARIANTS = 100

/** RFC 4180 split: quoted fields may hold commas, newlines and doubled quotes. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false
  const source = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text

  for (let i = 0; i < source.length; i++) {
    const ch = source[i]
    if (quoted) {
      if (ch === '"') {
        if (source[i + 1] === '"') {
          field += '"'
          i++
        } else quoted = false
      } else field += ch
      continue
    }
    if (ch === '"') {
      quoted = true
    } else if (ch === ',') {
      row.push(field)
      field = ''
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && source[i + 1] === '\n') i++
      row.push(field)
      rows.push(row)
      row = []
      field = ''
    } else field += ch
  }
  if (field !== '' || row.length > 0) {
    row.push(field)
    rows.push(row)
  }
  return rows.filter((r) => r.some((cell) => cell.trim() !== ''))
}

/** "₹1,299.00" → 129900; the rupee sign and grouping a spreadsheet adds are dropped first. */
const csvPaise = (value: string): number | null => parseRupees(value.replace(/[^0-9.-]/g, ''))

function toInt(value: string): number | null {
  const n = Number(value.replace(/[^0-9.-]/g, ''))
  return value.trim() === '' || Number.isNaN(n) ? null : Math.round(n)
}

function toBool(value: string, fallback: boolean): boolean {
  const v = value.trim().toLowerCase()
  if (v === '') return fallback
  return v === 'true' || v === 'yes' || v === '1' || v === 'active'
}

function toStatus(published: string, status: string): ProductStatus {
  const s = status.trim().toLowerCase()
  if (s === 'active' || s === 'draft' || s === 'archived') return s
  if (published.trim() === '') return 'draft'
  return toBool(published, false) ? 'active' : 'draft'
}

function splitTags(value: string): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const raw of value.split(',')) {
    const tag = raw.trim()
    const key = tag.toLowerCase()
    if (!tag || seen.has(key)) continue
    seen.add(key)
    out.push(tag)
  }
  return out
}

type Row = { get: (column: string) => string; index: number }

function optionNames(row: Row): string[] {
  const names: string[] = []
  for (let n = 1; n <= MAX_OPTIONS; n++) {
    const name = row.get(`option${n} name`).trim()
    if (!name || name.toLowerCase() === 'title') break
    names.push(name)
  }
  return names
}

function optionValues(row: Row, count: number): string[] {
  const values: string[] = []
  for (let n = 1; n <= count; n++) {
    const value = row.get(`option${n} value`).trim()
    if (!value || value.toLowerCase() === 'default title') break
    values.push(value)
  }
  return values
}

function readVariant(row: Row, names: string[]): ImportVariant {
  const grams = toInt(row.get('variant grams'))
  return {
    optionValues: optionValues(row, names.length),
    sku: row.get('variant sku').trim() || null,
    barcode: row.get('variant barcode').trim() || null,
    pricePaise: csvPaise(row.get('variant price')) ?? 0,
    mrpPaise: csvPaise(row.get('variant compare at price')),
    costPaise: csvPaise(row.get('variant cost') || row.get('cost per item')),
    taxable: toBool(row.get('variant taxable'), true),
    ...(row.get('variant requires shipping').trim()
      ? { requiresShipping: toBool(row.get('variant requires shipping'), true) }
      : {}),
    trackInventory: row.get('variant inventory tracker').trim().toLowerCase() !== 'not tracked',
    weightGrams: grams,
    onHand: Math.max(0, toInt(row.get('variant inventory qty')) ?? 0),
  }
}

/**
 * Parse a Shopify product CSV. Never throws: unreadable rows become issues so
 * the dry run can show them next to what would be imported.
 */
export function parseProductCsv(text: string): ParsedImport {
  const rows = parseCsv(text)
  const header = rows[0]
  if (!header) {
    return {
      products: [],
      issues: [{ row: 0, handle: null, message: 'The file is empty' }],
      ignoredColumns: [],
    }
  }
  const columns = header.map((h) => h.trim().toLowerCase())
  if (!columns.includes('handle')) {
    return {
      products: [],
      issues: [
        { row: 1, handle: null, message: 'No Handle column. Export from Shopify as Products CSV.' },
      ],
      ignoredColumns: [],
    }
  }

  const issues: ImportIssue[] = []
  const byHandle = new Map<string, ImportProduct>()

  for (let i = 1; i < rows.length; i++) {
    const cells = rows[i] ?? []
    const row: Row = {
      index: i + 1,
      get: (column) => {
        const at = columns.indexOf(column)
        return at === -1 ? '' : (cells[at] ?? '')
      },
    }
    const handle = row.get('handle').trim()
    if (!handle) {
      issues.push({ row: row.index, handle: null, message: 'Row has no handle' })
      continue
    }

    const existing = byHandle.get(handle)
    const title = row.get('title').trim()
    const image = row.get('image src').trim()

    if (!existing) {
      if (!title) {
        issues.push({ row: row.index, handle, message: 'First row for this handle has no title' })
        continue
      }
      const names = optionNames(row)
      const product: ImportProduct = {
        handle,
        title,
        descriptionHtml: (row.get('body (html)') || row.get('body')).trim() || null,
        vendor: row.get('vendor').trim() || null,
        productType: (row.get('type') || row.get('product type')).trim() || null,
        tags: splitTags(row.get('tags')),
        status: toStatus(row.get('published'), row.get('status')),
        seoTitle: row.get('seo title').trim() || null,
        seoDescription: row.get('seo description').trim() || null,
        optionNames: names,
        variants: [readVariant(row, names)],
        imageUrls: image ? [image] : [],
      }
      byHandle.set(handle, product)
      continue
    }

    if (image && !existing.imageUrls.includes(image)) existing.imageUrls.push(image)
    const values = optionValues(row, existing.optionNames.length)
    // An image-only row repeats the handle and nothing else; it adds no variant.
    const hasVariantData =
      row.get('variant price').trim() !== '' ||
      row.get('variant sku').trim() !== '' ||
      values.length > 0
    if (!hasVariantData) continue
    if (existing.variants.length >= MAX_VARIANTS) {
      issues.push({
        row: row.index,
        handle,
        message: `More than ${MAX_VARIANTS} variants; the rest were skipped`,
      })
      continue
    }
    const next = readVariant(row, existing.optionNames)
    const duplicate = existing.variants.some(
      (v) => variantTitle(v.optionValues) === variantTitle(next.optionValues),
    )
    if (duplicate) {
      issues.push({
        row: row.index,
        handle,
        message: `Duplicate variant ${variantTitle(next.optionValues)}`,
      })
      continue
    }
    existing.variants.push(next)
  }

  const products = [...byHandle.values()].filter((p) => {
    if (p.optionNames.length === 0) return true
    const incomplete = p.variants.find((v) => v.optionValues.length !== p.optionNames.length)
    if (!incomplete) return true
    issues.push({
      row: 0,
      handle: p.handle,
      message: `Variant ${variantTitle(incomplete.optionValues) || '(blank)'} does not fill every option`,
    })
    return false
  })

  return {
    products,
    issues,
    ignoredColumns: header
      .map((h) => h.trim())
      .filter((h) => h && !KNOWN_COLUMNS.has(h.toLowerCase())),
  }
}

/** Counts for the dry-run preview. */
export function summariseImport(parsed: ParsedImport, existingHandles: string[]) {
  const existing = new Set(existingHandles)
  const updates = parsed.products.filter((p) => existing.has(p.handle))
  return {
    total: parsed.products.length,
    created: parsed.products.length - updates.length,
    updated: updates.length,
    variants: parsed.products.reduce((n, p) => n + p.variants.length, 0),
    images: parsed.products.reduce((n, p) => n + p.imageUrls.length, 0),
    issues: parsed.issues.length,
  }
}
