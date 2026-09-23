/**
 * Shopify product CSV → NProduct. One row per variant, the handle repeated on
 * each; product columns are filled on the first row only; image-only rows add
 * gallery entries. Pure: never throws, unreadable rows become issues.
 */
import { bool, type CsvRow, cleanId, hasColumn, int, paise, readTable, tags, toGrams } from './csv'
import type { Issue, NImage, NProduct, NVariant } from './types'

const MAX_OPTIONS = 3
const MAX_VARIANTS = 100

/** HSN lives in a metafield on most Indian stores; Shopify exports it as `Name (product.metafields.ns.key)`. */
const isHsnHeader = (h: string) =>
  h === 'variant hs code' ||
  h === 'hs code' ||
  h === 'hsn' ||
  h === 'hsn code' ||
  (h.includes('metafield') && /\bhsn\b|hsn[_ ]?code|hs[_ ]code/.test(h))

export function readHsn(row: CsvRow): string | null {
  for (const { value } of row.matching(isHsnHeader)) {
    const digits = value.replace(/\D/g, '')
    if (digits.length >= 4 && digits.length <= 8) return digits
  }
  return null
}

function status(row: CsvRow): NProduct['status'] {
  const s = row.get('status').toLowerCase()
  if (s === 'active' || s === 'draft' || s === 'archived') return s
  const published = row.get('published')
  return published && bool(published, false) ? 'active' : 'draft'
}

function optionNames(row: CsvRow): string[] {
  const names: string[] = []
  for (let n = 1; n <= MAX_OPTIONS; n++) {
    const name = row.get(`option${n} name`)
    if (!name) break
    if (name.toLowerCase() === 'title' && row.get(`option${n} value`) === 'Default Title') break
    names.push(name)
  }
  return names
}

function optionValues(row: CsvRow, count: number): string[] {
  const values: string[] = []
  for (let n = 1; n <= count; n++) {
    const value = row.get(`option${n} value`)
    if (!value) break
    values.push(value)
  }
  return values
}

function readVariant(
  row: CsvRow,
  names: string[],
  columns: { tracker: boolean; qty: boolean },
): NVariant {
  const grams = row.get('variant grams')
  return {
    sourceId: null,
    optionValues: optionValues(row, names.length),
    sku: cleanId(row.get('variant sku')),
    barcode: cleanId(row.get('variant barcode')),
    pricePaise: paise(row.get('variant price')) ?? 0,
    mrpPaise: paise(row.get('variant compare at price')),
    costPaise: paise(row.get('cost per item', 'variant cost')),
    taxable: bool(row.get('variant taxable'), true),
    // Shopify writes `shopify` for tracked variants and leaves the cell empty otherwise.
    trackInventory: columns.tracker
      ? row.get('variant inventory tracker') !== '' &&
        row.get('variant inventory tracker').toLowerCase() !== 'not tracked'
      : true,
    weightGrams: grams
      ? int(grams)
      : toGrams(row.get('variant weight'), row.get('variant weight unit') || 'g'),
    onHand: columns.qty ? Math.max(0, int(row.get('variant inventory qty')) ?? 0) : null,
    hsCode: readHsn(row),
    imageSrc: row.get('variant image') || null,
  }
}

function addImage(images: NImage[], src: string, alt: string, position: number | null) {
  if (!src || images.some((i) => i.src === src)) return
  // Images only named as a variant image go after the numbered gallery.
  images.push({ src, alt: alt || null, position: position ?? 10_000 + images.length })
}

const variantKey = (v: NVariant) => v.optionValues.join(' / ')

export function parseProductsCsv(text: string): { products: NProduct[]; issues: Issue[] } {
  const table = readTable(text)
  const issues: Issue[] = []
  if (table.headers.length === 0) {
    return {
      products: [],
      issues: [{ resource: 'products', row: 1, message: 'The file is empty' }],
    }
  }
  if (!hasColumn(table, 'handle')) {
    return {
      products: [],
      issues: [
        {
          resource: 'products',
          row: 1,
          message: 'No Handle column. In Shopify, export Products as CSV for Excel or plain CSV.',
        },
      ],
    }
  }
  const columns = {
    tracker: hasColumn(table, 'variant inventory tracker'),
    qty: hasColumn(table, 'variant inventory qty'),
  }
  const byHandle = new Map<string, NProduct>()

  for (const row of table.rows) {
    const handle = row.get('handle')
    if (!handle) {
      issues.push({ resource: 'products', row: row.line, message: 'Row has no handle' })
      continue
    }
    let product = byHandle.get(handle)
    const imageSrc = row.get('image src')
    const imagePosition = int(row.get('image position'))
    const imageAlt = row.get('image alt text')

    if (!product) {
      const title = row.get('title')
      if (!title) {
        issues.push({
          resource: 'products',
          row: row.line,
          ref: handle,
          message: 'The first row for this handle has no title',
        })
        continue
      }
      const names = optionNames(row)
      product = {
        sourceId: null,
        handle,
        title,
        bodyHtml: row.get('body (html)', 'body') || null,
        vendor: row.get('vendor') || null,
        productType: row.get('type', 'product type', 'product category') || null,
        tags: tags(row.get('tags')),
        status: status(row),
        seoTitle: row.get('seo title') || null,
        seoDescription: row.get('seo description') || null,
        optionNames: names,
        variants: [readVariant(row, names, columns)],
        images: [],
        row: row.line,
      }
      byHandle.set(handle, product)
      addImage(product.images, imageSrc, imageAlt, imagePosition)
      const variantImage = product.variants[0]?.imageSrc
      if (variantImage) addImage(product.images, variantImage, '', null)
      continue
    }

    addImage(product.images, imageSrc, imageAlt, imagePosition)
    const values = optionValues(row, product.optionNames.length)
    const hasVariant =
      row.get('variant price') !== '' || row.get('variant sku') !== '' || values.length > 0
    if (!hasVariant) continue
    if (product.variants.length >= MAX_VARIANTS) {
      issues.push({
        resource: 'products',
        row: row.line,
        ref: handle,
        message: `More than ${MAX_VARIANTS} variants; the rest were skipped`,
      })
      continue
    }
    const variant = readVariant(row, product.optionNames, columns)
    if (product.variants.some((v) => variantKey(v) === variantKey(variant))) {
      issues.push({
        resource: 'products',
        row: row.line,
        ref: handle,
        message: `Duplicate variant ${variantKey(variant) || 'Default'}`,
      })
      continue
    }
    if (variant.imageSrc) addImage(product.images, variant.imageSrc, '', null)
    product.variants.push(variant)
  }

  const products: NProduct[] = []
  for (const p of byHandle.values()) {
    const incomplete = p.variants.find((v) => v.optionValues.length !== p.optionNames.length)
    if (p.optionNames.length > 0 && incomplete) {
      issues.push({
        resource: 'products',
        row: p.row,
        ref: p.handle,
        message: `Variant ${variantKey(incomplete) || '(blank)'} does not fill every option`,
      })
      continue
    }
    p.images.sort((a, b) => a.position - b.position)
    p.images.forEach((image, i) => {
      image.position = i + 1
    })
    products.push(p)
  }
  return { products, issues }
}
