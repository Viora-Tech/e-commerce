import 'server-only'
import {
  activeCollectionRows,
  type LiquidProductData,
  loadProducts,
  notSystemTest,
  richTextHtml,
} from '@commerce/core'
import { collection, collectionProduct, product, type StoreTx } from '@commerce/db'
import { and, asc, desc, eq, inArray } from 'drizzle-orm'
import { SHOPIFY_JSON } from '@/data/shopify-json'
import type { FeedCollection, FeedProduct } from './shape'

/**
 * Published products and collections for the Shopify-compatible public JSON: active products
 * only (never drafts, archived or the payments wizard's test product), active collections, and
 * the variants and images a shopper sees on the product page (`loadProducts` drops hidden and
 * archived variants). Markets' catalogs apply as on every other listing.
 */

/** The page's products, fully loaded, with Shopify's dates. */
async function withDates(
  tx: StoreTx,
  rows: { id: string; updatedAt: Date }[],
): Promise<FeedProduct[]> {
  const updated = new Map(rows.map((r) => [r.id, r.updatedAt]))
  const loaded: LiquidProductData[] = await loadProducts(
    tx,
    rows.map((r) => r.id),
  )
  return loaded.map((p) => ({ ...p, updatedAt: updated.get(p.id) ?? p.createdAt }))
}

const listed = and(eq(product.status, 'active'), notSystemTest)

/** One page of every published product, newest first (as Shopify's `/products.json`). */
export async function feedProducts(
  tx: StoreTx,
  paging: { limit: number; page: number },
): Promise<FeedProduct[]> {
  const rows = await tx
    .select({ id: product.id, updatedAt: product.updatedAt })
    .from(product)
    .where(listed)
    .orderBy(desc(product.createdAt), asc(product.id))
    .limit(paging.limit)
    .offset((paging.page - 1) * paging.limit)
  return withDates(tx, rows)
}

/**
 * One page of a collection's products in its own order; null when no active collection has
 * that handle. `all` is every product, as on Shopify.
 */
export async function feedCollectionProducts(
  tx: StoreTx,
  handle: string,
  paging: { limit: number; page: number },
): Promise<FeedProduct[] | null> {
  if (handle === 'all') return feedProducts(tx, paging)
  const [found] = await tx
    .select({ id: collection.id })
    .from(collection)
    .where(and(eq(collection.handle, handle), eq(collection.status, 'active')))
  if (!found) return null
  const rows = await tx
    .select({ id: product.id, updatedAt: product.updatedAt })
    .from(collectionProduct)
    .innerJoin(product, eq(product.id, collectionProduct.productId))
    .where(and(eq(collectionProduct.collectionId, found.id), listed))
    .orderBy(asc(collectionProduct.position), asc(product.id))
    .limit(paging.limit)
    .offset((paging.page - 1) * paging.limit)
  return withDates(tx, rows)
}

/** One published product by handle; null for a draft, an archived one or none. */
export async function feedProduct(tx: StoreTx, handle: string): Promise<FeedProduct | null> {
  const rows = await tx
    .select({ id: product.id, updatedAt: product.updatedAt })
    .from(product)
    .where(and(eq(product.handle, handle), listed))
  return (await withDates(tx, rows))[0] ?? null
}

/** Every active collection A to Z, with its live product count. */
export async function feedCollections(tx: StoreTx): Promise<FeedCollection[]> {
  const rows = (await activeCollectionRows(tx)).slice(0, SHOPIFY_JSON.collectionsLimit)
  const dates = rows.length
    ? await tx
        .select({ id: collection.id, updatedAt: collection.updatedAt })
        .from(collection)
        .where(
          inArray(
            collection.id,
            rows.map((r) => r.id),
          ),
        )
    : []
  const updated = new Map(dates.map((d) => [d.id, d.updatedAt]))
  return rows.map((r) => ({
    id: r.id,
    handle: r.handle,
    title: r.title,
    descriptionHtml: richTextHtml(r.description),
    updatedAt: updated.get(r.id) ?? new Date(0),
    image: r.imageUrl
      ? {
          url: r.imageUrl,
          alt: r.imageAlt ?? r.title,
          width: r.width,
          height: r.height,
        }
      : null,
    productsCount: Number(r.count),
  }))
}
