import type { LiquidImageData, LiquidProductData } from '@commerce/core'
import { numericId } from '@commerce/core/theme-import'
import { SHOPIFY_JSON } from '@/data/shopify-json'

/**
 * Shopify's public storefront JSON (`/products.json`, `/collections/<h>/products.json`,
 * `/products/<h>.json`, `/collections.json`) built from our published products. Pure. Price
 * comparison sites and feed tools read these on every Shopify store; the field names and
 * shapes follow Shopify's own answers, prices as rupee strings (`"899.00"`). Nothing private:
 * no stock counts, costs or draft data. `/products/<h>.js` (paise) is `shopifyProductJson`.
 */

/** A product with the dates Shopify writes, which the theme loader leaves out. */
export type FeedProduct = LiquidProductData & { updatedAt: Date }

export type FeedCollection = {
  id: string
  handle: string
  title: string
  descriptionHtml: string
  updatedAt: Date
  image: LiquidImageData | null
  productsCount: number
}

/** Whole paise as Shopify's decimal string: 89900 → "899.00". */
export function rupees(paise: number): string {
  const whole = Math.trunc(paise)
  const sign = whole < 0 ? '-' : ''
  const abs = Math.abs(whole)
  return `${sign}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, '0')}`
}

const iso = (d: Date) => d.toISOString()

/** The images in order with Shopify's ids, and which variants show each one. */
function imagesOf(p: FeedProduct) {
  const productId = numericId(p.id)
  const at = iso(p.createdAt)
  const updated = iso(p.updatedAt)
  return p.images.map((img, n) => ({
    id: img.id ? numericId(img.id) : null,
    created_at: at,
    position: n + 1,
    updated_at: updated,
    product_id: productId,
    variant_ids: p.variants
      .filter((v) => img.id && v.image?.id === img.id)
      .map((v) => numericId(v.id)),
    src: img.url,
    width: img.width ?? null,
    height: img.height ?? null,
    alt: img.alt ?? null,
  }))
}

type ShopifyImage = ReturnType<typeof imagesOf>[number]

/** A variant's image as the product's image entry (its position and variant ids), else null. */
function variantImage(p: FeedProduct, images: ShopifyImage[], id: string | undefined) {
  if (!id) return null
  const n = p.images.findIndex((i) => i.id === id)
  return n >= 0 ? (images[n] ?? null) : null
}

/**
 * One product as `/products.json` and `/collections/<h>/products.json` list it: tags an array,
 * every variant's `price`, `compare_at_price` and `available`, images with their sizes.
 */
export function listProduct(p: FeedProduct) {
  const productId = numericId(p.id)
  const images = imagesOf(p)
  return {
    id: productId,
    title: p.title,
    handle: p.handle,
    body_html: p.descriptionHtml,
    published_at: iso(p.createdAt),
    created_at: iso(p.createdAt),
    updated_at: iso(p.updatedAt),
    vendor: p.vendor,
    product_type: p.type,
    tags: p.tags,
    variants: p.variants.map((v, n) => ({
      id: numericId(v.id),
      title: v.title,
      option1: v.options[0] ?? null,
      option2: v.options[1] ?? null,
      option3: v.options[2] ?? null,
      sku: v.sku ?? '',
      requires_shipping: true,
      taxable: true,
      featured_image: variantImage(p, images, v.image?.id),
      available: v.available,
      price: rupees(v.price),
      grams: v.weightGrams ?? 0,
      compare_at_price: v.compareAtPrice != null ? rupees(v.compareAtPrice) : null,
      position: n + 1,
      product_id: productId,
      created_at: iso(p.createdAt),
      updated_at: iso(p.updatedAt),
    })),
    images,
    options: p.options.map((o, i) => ({ name: o.name, position: i + 1, values: o.values })),
  }
}

/**
 * One product as `/products/<h>.json` writes it (`{ product }`): Shopify's REST shape, with
 * tags as one comma-separated string and the first image as `image`.
 */
export function productDetail(p: FeedProduct) {
  const productId = numericId(p.id)
  const images = imagesOf(p)
  return {
    id: productId,
    title: p.title,
    body_html: p.descriptionHtml,
    vendor: p.vendor,
    product_type: p.type,
    created_at: iso(p.createdAt),
    handle: p.handle,
    updated_at: iso(p.updatedAt),
    published_at: iso(p.createdAt),
    template_suffix: null,
    published_scope: 'global',
    tags: p.tags.join(', '),
    variants: p.variants.map((v, n) => ({
      id: numericId(v.id),
      product_id: productId,
      title: v.title,
      price: rupees(v.price),
      sku: v.sku ?? '',
      position: n + 1,
      compare_at_price: v.compareAtPrice != null ? rupees(v.compareAtPrice) : null,
      fulfillment_service: 'manual',
      inventory_management: 'shopify',
      option1: v.options[0] ?? null,
      option2: v.options[1] ?? null,
      option3: v.options[2] ?? null,
      created_at: iso(p.createdAt),
      updated_at: iso(p.updatedAt),
      taxable: true,
      barcode: v.barcode ?? '',
      grams: v.weightGrams ?? 0,
      image_id: variantImage(p, images, v.image?.id)?.id ?? null,
      weight: (v.weightGrams ?? 0) / 1000,
      weight_unit: 'kg',
      requires_shipping: true,
      price_currency: SHOPIFY_JSON.currency,
      available: v.available,
    })),
    options: p.options.map((o, i) => ({
      product_id: productId,
      name: o.name,
      position: i + 1,
      values: o.values,
    })),
    images,
    image: images[0] ?? null,
  }
}

/** One collection as `/collections.json` and `/collections/<h>.json` write it. */
export function collectionJson(c: FeedCollection) {
  return {
    id: c.id === 'all' ? 'all' : numericId(c.id),
    title: c.title,
    handle: c.handle,
    description: c.descriptionHtml,
    published_at: iso(c.updatedAt),
    updated_at: iso(c.updatedAt),
    image: c.image
      ? {
          id: c.image.id ? numericId(c.image.id) : null,
          created_at: iso(c.updatedAt),
          src: c.image.url,
          alt: c.image.alt ?? null,
          width: c.image.width ?? null,
          height: c.image.height ?? null,
        }
      : null,
    products_count: c.productsCount,
  }
}

/** `limit` and `page` as Shopify reads them: 30 by default, at most 250; pages from 1. */
export function feedPaging(params: URLSearchParams): { limit: number; page: number } {
  const int = (name: string) => Number.parseInt(params.get(name) ?? '', 10)
  const limit = int('limit')
  const page = int('page')
  return {
    limit:
      Number.isFinite(limit) && limit > 0
        ? Math.min(limit, SHOPIFY_JSON.maxLimit)
        : SHOPIFY_JSON.defaultLimit,
    page: Number.isFinite(page) && page > 0 ? Math.min(page, SHOPIFY_JSON.maxPage) : 1,
  }
}
