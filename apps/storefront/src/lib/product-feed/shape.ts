/**
 * SOURCE OF TRUTH: the public product feed's rows and files — WHAT: one row per published variant
 * (id, name, price, compare price, in or out of stock, link, image, brand, SKU) written as Google
 * Merchant RSS (`/feeds/products.xml`) or CSV (`/feeds/products.csv`) / WHY: price comparison
 * sites and feed tools read a plain file; stock is in/out only, never a count. Pure.
 */

import { numericId } from '@commerce/core/theme-import'
import { PRODUCT_FEED } from '@/data/product-feed'
import type { FeedProduct } from '../shopify-json/shape'
import { rupees } from '../shopify-json/shape'

export type FeedRow = {
  id: string
  /** The product's id: Google's `item_group_id`, the same for every variant of one product. */
  groupId: string
  name: string
  /** Rupees, `"899.00"`. */
  price: string
  /** The higher "was" price, or null when there is none. */
  comparePrice: string | null
  availability: 'in_stock' | 'out_of_stock'
  link: string
  image: string | null
  brand: string
  sku: string
}

/** A product's own variant names (`Default Title` is Shopify's name for "no options"). */
const NO_OPTIONS = 'Default Title'

/** A store URL for a path or an absolute URL as it is. */
const absolute = (origin: string, url: string) =>
  /^https?:\/\//i.test(url) ? url : `${origin}${url.startsWith('/') ? '' : '/'}${url}`

/** Every published variant of the products as a feed row, in the products' order. */
export function feedRows(
  products: readonly FeedProduct[],
  ctx: { origin: string; storeName: string },
): FeedRow[] {
  const rows: FeedRow[] = []
  for (const p of products) {
    const several = p.variants.length > 1
    const productLink = `${ctx.origin}/products/${encodeURIComponent(p.handle)}`
    for (const v of p.variants) {
      if (rows.length >= PRODUCT_FEED.maxRows) return rows
      const variantId = String(numericId(v.id))
      const named = several && v.title && v.title !== NO_OPTIONS
      const image = v.image?.url ?? p.images[0]?.url ?? null
      const compare =
        v.compareAtPrice != null && v.compareAtPrice > v.price ? rupees(v.compareAtPrice) : null
      rows.push({
        id: variantId,
        groupId: String(numericId(p.id)),
        name: named ? `${p.title} - ${v.title}` : p.title,
        price: rupees(v.price),
        comparePrice: compare,
        availability: v.available ? 'in_stock' : 'out_of_stock',
        link: several ? `${productLink}?variant=${variantId}` : productLink,
        image: image ? absolute(ctx.origin, image) : null,
        brand: p.vendor.trim() || ctx.storeName,
        sku: v.sku ?? '',
      })
    }
  }
  return rows
}

const XML_ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&apos;',
}

/** Text for an XML element, with characters XML 1.0 forbids dropped. */
export function xmlText(value: string): string {
  // biome-ignore lint/suspicious/noControlCharactersInRegex: stripping what XML 1.0 cannot carry
  const clean = value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g, '')
  return clean.replace(/[&<>"']/g, (c) => XML_ESCAPES[c] ?? c)
}

const tag = (name: string, value: string) => `<${name}>${xmlText(value)}</${name}>`

/**
 * Google Merchant Center's RSS 2.0 feed. Google reads `price` as the regular price and
 * `sale_price` as what the shopper pays, so a variant with a compare price writes both.
 */
export function feedXml(
  rows: readonly FeedRow[],
  channel: { title: string; link: string; description: string },
): string {
  const currency = PRODUCT_FEED.currency
  const items = rows.map((r) =>
    [
      '<item>',
      tag('g:id', r.id),
      tag('g:item_group_id', r.groupId),
      tag('title', r.name),
      tag('link', r.link),
      r.image ? tag('g:image_link', r.image) : '',
      tag('g:price', `${r.comparePrice ?? r.price} ${currency}`),
      r.comparePrice ? tag('g:sale_price', `${r.price} ${currency}`) : '',
      tag('g:availability', r.availability),
      tag('g:brand', r.brand),
      r.sku ? tag('g:mpn', r.sku) : '',
      tag('g:condition', 'new'),
      '</item>',
    ].join(''),
  )
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">',
    '<channel>',
    tag('title', channel.title),
    tag('link', channel.link),
    tag('description', channel.description),
    ...items,
    '</channel>',
    '</rss>',
    '',
  ].join('\n')
}

/** The CSV's header row, in column order. */
export const CSV_COLUMNS = [
  'id',
  'title',
  'price',
  'compare_at_price',
  'availability',
  'link',
  'image_link',
  'brand',
  'sku',
] as const

/**
 * One CSV cell (RFC 4180). A text cell starting with `=`, `+`, `-`, `@`, tab or return gets a `'`
 * first, so a spreadsheet opening the file never runs it as a formula.
 */
export function csvCell(value: string, text = true): string {
  const safe = text && /^[=+\-@\t\r]/.test(value) ? `'${value}` : value
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe
}

/** The feed as CSV with a header row; prices are plain numbers in the store's currency. */
export function feedCsv(rows: readonly FeedRow[]): string {
  const lines = rows.map((r) =>
    [
      csvCell(r.id, false),
      csvCell(r.name),
      csvCell(r.price, false),
      csvCell(r.comparePrice ?? '', false),
      csvCell(r.availability, false),
      csvCell(r.link, false),
      csvCell(r.image ?? '', false),
      csvCell(r.brand),
      csvCell(r.sku),
    ].join(','),
  )
  return `${[CSV_COLUMNS.join(','), ...lines].join('\r\n')}\r\n`
}
