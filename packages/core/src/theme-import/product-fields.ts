/** SOURCE OF TRUTH: a product's extra fields for our own product block — WHAT: the product's `custom` metafields as text and HTML by key, the review rating Shopify apps keep in `reviews.rating` / `reviews.rating_count`, and the breadcrumb's collection / WHY: an imported theme's main-product section read these (spec cells, metafield accordions, stars); `MainProduct` replaces that section, so it reads the same values */

import { collection, collectionProduct, type StoreTx } from '@commerce/db'
import { and, asc, eq } from 'drizzle-orm'
import { loadMetafields } from './custom-data'
import type { LiquidMetafieldData } from './drops'

/** One field ready to show: `text` for parsing (spec rows, cells), `html` for a panel body. */
export type ProductFieldText = { text: string; html: string }

export type ProductDisplayFields = {
  /** `custom` namespace only, as the theme read them (`product.metafields.custom[key]`). */
  fields: Record<string, ProductFieldText>
  /** The imported review summary, when the product carries one with at least one review. */
  rating: { value: number; count: number } | null
}

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

const stripTags = (html: string) =>
  html
    .replace(/<\/(p|li|h[1-6]|div)>|<br\s*\/?>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{2,}/g, '\n')
    .trim()

/** A scalar as words: text, a number, yes/no, a measurement (`54 g`) or a rating (`4.5`). */
function scalarText(value: unknown): string | null {
  if (typeof value === 'string') return value.trim() || null
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  if (value && typeof value === 'object' && 'value' in value) {
    const v = (value as { value: unknown; unit?: unknown }).value
    const unit = (value as { unit?: unknown }).unit
    const head = scalarText(v)
    if (!head) return null
    return typeof unit === 'string' && unit ? `${head} ${unit.toLowerCase()}` : head
  }
  return null
}

function fieldText(f: LiquidMetafieldData): ProductFieldText | null {
  if (f.type === 'rich_text' && typeof f.value === 'string') {
    const text = stripTags(f.value)
    return text ? { text, html: f.value } : null
  }
  if (Array.isArray(f.value)) {
    const items = f.value.flatMap((v) => scalarText(v) ?? [])
    if (items.length === 0) return null
    return {
      text: items.join('\n'),
      html: `<ul>${items.map((i) => `<li>${escapeHtml(i)}</li>`).join('')}</ul>`,
    }
  }
  const text = scalarText(f.value)
  if (!text) return null
  return { text, html: escapeHtml(text).replace(/\r?\n/g, '<br>') }
}

const ratingNumber = (value: unknown): number | null => {
  const raw =
    value && typeof value === 'object' && 'value' in value
      ? (value as { value: unknown }).value
      : value
  const n = typeof raw === 'string' ? Number(raw) : raw
  return typeof n === 'number' && Number.isFinite(n) ? n : null
}

/** One product's loaded metafields (`loadMetafields(tx, 'product', [id])`) as the block reads them. */
export function productDisplayFields(list: LiquidMetafieldData[]): ProductDisplayFields {
  const fields: Record<string, ProductFieldText> = {}
  let value: number | null = null
  let count: number | null = null
  for (const f of list) {
    if (f.namespace === 'custom') {
      const shown = fieldText(f)
      if (shown) fields[f.key] = shown
    } else if (f.namespace === 'reviews' && f.key === 'rating') {
      value = ratingNumber(f.value)
    } else if (f.namespace === 'reviews' && f.key === 'rating_count') {
      count = ratingNumber(f.value)
    }
  }
  const rating =
    value !== null && value > 0 && count !== null && count > 0
      ? { value: Math.min(5, value), count: Math.round(count) }
      : null
  return { fields, rating }
}

/**
 * Merchandising lists that hold products of every kind say nothing as a crumb; the theme's
 * breadcrumbs skipped them for the first collection that says what the product is.
 */
const CATCH_ALL = new Set([
  'all',
  'frontpage',
  'best-sellers',
  'new-arrivals',
  'sale',
  'holidays-sale',
  'preorder',
])

export type ProductPageExtras = ProductDisplayFields & {
  /** The breadcrumb's middle step: the first active collection that is not a catch-all list. */
  collection: { title: string; url: string } | null
}

/**
 * What the product block shows beyond the catalogue row: the product's storefront-visible
 * extra fields, its imported rating, and the collection for the breadcrumb (by title, a
 * catch-all list only when the product is in nothing else).
 */
export async function loadProductPageExtras(
  tx: StoreTx,
  productId: string,
): Promise<ProductPageExtras> {
  const [data, collections] = await Promise.all([
    loadMetafields(tx, 'product', [productId]),
    tx
      .select({ handle: collection.handle, title: collection.title })
      .from(collectionProduct)
      .innerJoin(collection, eq(collection.id, collectionProduct.collectionId))
      .where(and(eq(collectionProduct.productId, productId), eq(collection.status, 'active')))
      .orderBy(asc(collection.title)),
  ])
  const crumb = collections.find((c) => !CATCH_ALL.has(c.handle)) ?? collections[0]
  return {
    ...productDisplayFields(data.metafields[productId] ?? []),
    collection: crumb ? { title: crumb.title, url: `/collections/${crumb.handle}` } : null,
  }
}
