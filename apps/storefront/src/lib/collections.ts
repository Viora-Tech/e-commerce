import 'server-only'
import type { CardProduct } from '@commerce/blocks'
import type { CollectionSort } from '@commerce/core/collections'
import type { StoreTx } from '@commerce/db'
import {
  collection,
  collectionProduct,
  media,
  product,
  productMedia,
  sellableStock,
  variant,
} from '@commerce/db'
import type { RichTextValue } from '@commerce/richtext'
import { and, asc, desc, eq, inArray, isNull, sql } from 'drizzle-orm'

export type CollectionDetail = {
  id: string
  handle: string
  title: string
  description: RichTextValue | string | null
  imageUrl: string | null
  seoTitle: string | null
  seoDescription: string | null
  sortOrder: CollectionSort
  templateSuffix: string | null
}

export type CollectionCard = {
  handle: string
  title: string
  imageUrl: string | null
  productCount: number
}

/** Untracked variants are always purchasable; mirrors `catalog.ts`. */
function availableFor(v: {
  onHand: number | null
  reserved: number | null
  trackInventory: boolean
}): number {
  if (!v.trackInventory) return 999
  return Math.max(0, (v.onHand ?? 0) - (v.reserved ?? 0))
}

export async function listCollections(tx: StoreTx): Promise<CollectionCard[]> {
  const rows = await tx
    .select({
      id: collection.id,
      handle: collection.handle,
      title: collection.title,
      imageUrl: media.url,
    })
    .from(collection)
    .leftJoin(media, eq(media.id, collection.imageMediaId))
    .where(eq(collection.status, 'active'))
    .orderBy(asc(collection.title))
  if (rows.length === 0) return []
  const counts = await tx
    .select({ collectionId: collectionProduct.collectionId, n: sql<number>`count(*)` })
    .from(collectionProduct)
    .where(
      inArray(
        collectionProduct.collectionId,
        rows.map((r) => r.id),
      ),
    )
    .groupBy(collectionProduct.collectionId)
  return rows.map((r) => ({
    handle: r.handle,
    title: r.title,
    imageUrl: r.imageUrl,
    productCount: Number(counts.find((c) => c.collectionId === r.id)?.n ?? 0),
  }))
}

export async function getCollectionByHandle(
  tx: StoreTx,
  handle: string,
): Promise<CollectionDetail | null> {
  const [row] = await tx
    .select()
    .from(collection)
    .where(and(eq(collection.handle, handle), eq(collection.status, 'active')))
  if (!row) return null
  const [image] = row.imageMediaId
    ? await tx.select({ url: media.url }).from(media).where(eq(media.id, row.imageMediaId))
    : []
  return {
    id: row.id,
    handle: row.handle,
    title: row.title,
    description: row.description as RichTextValue | string | null,
    imageUrl: image?.url ?? null,
    seoTitle: row.seoTitle,
    seoDescription: row.seoDescription,
    sortOrder: row.sortOrder,
    templateSuffix: row.templateSuffix,
  }
}

/** Sort keys the storefront honours; `manual` follows `collection_product.position`. */
function orderFor(sort: CollectionSort) {
  if (sort === 'title_asc') return asc(product.title)
  if (sort === 'title_desc') return desc(product.title)
  if (sort === 'created_desc') return desc(product.createdAt)
  return asc(collectionProduct.position)
}

export type CollectionProducts = { items: CardProduct[]; total: number }

/**
 * Products in a collection as cards. Price sorts are applied in memory over
 * the page's rows because the card price is the cheapest live variant, which
 * is computed after the join rather than stored on the product.
 */
export async function listCollectionProducts(
  tx: StoreTx,
  collectionId: string,
  options: { sort: CollectionSort; page: number; perPage: number },
): Promise<CollectionProducts> {
  const where = and(eq(collectionProduct.collectionId, collectionId), eq(product.status, 'active'))
  const [countRow] = await tx
    .select({ total: sql<number>`count(*)` })
    .from(collectionProduct)
    .innerJoin(product, eq(product.id, collectionProduct.productId))
    .where(where)
  const total = Number(countRow?.total ?? 0)

  const rows = await tx
    .select({
      id: product.id,
      handle: product.handle,
      title: product.title,
      vendor: product.vendor,
      productType: product.productType,
    })
    .from(collectionProduct)
    .innerJoin(product, eq(product.id, collectionProduct.productId))
    .where(where)
    .orderBy(orderFor(options.sort))
    .limit(options.perPage)
    .offset((options.page - 1) * options.perPage)
  if (rows.length === 0) return { items: [], total }

  const ids = rows.map((r) => r.id)
  const variants = await tx
    .select({
      productId: variant.productId,
      pricePaise: variant.pricePaise,
      mrpPaise: variant.mrpPaise,
      onHand: sellableStock.onHand,
      reserved: sellableStock.reserved,
      trackInventory: variant.trackInventory,
    })
    .from(variant)
    .leftJoin(sellableStock, eq(sellableStock.variantId, variant.id))
    .where(and(inArray(variant.productId, ids), isNull(variant.archivedAt)))
  const images = await tx
    .select({
      productId: productMedia.productId,
      url: media.url,
      alt: media.alt,
      variants: media.variants,
      thumbhash: media.thumbhash,
    })
    .from(productMedia)
    .innerJoin(media, eq(media.id, productMedia.mediaId))
    .where(and(inArray(productMedia.productId, ids), sql`${productMedia.position} < 2`))
    .orderBy(asc(productMedia.position))

  const items = rows.map((p) => {
    const vs = variants.filter((v) => v.productId === p.id)
    const cheapest = vs.reduce<(typeof vs)[number] | null>(
      (m, v) => (m === null || v.pricePaise < m.pricePaise ? v : m),
      null,
    )
    return {
      id: p.id,
      handle: p.handle,
      title: p.title,
      vendor: p.vendor,
      productType: p.productType,
      pricePaise: cheapest?.pricePaise ?? 0,
      mrpPaise: cheapest?.mrpPaise ?? null,
      available: vs.reduce((n, v) => n + availableFor(v), 0),
      images: images
        .filter((i) => i.productId === p.id)
        .map((i) => ({
          url: i.url,
          alt: i.alt,
          variants: i.variants as Record<string, { avif: string; webp: string }> | null,
          thumbhash: i.thumbhash,
        })),
    }
  })

  if (options.sort === 'price_asc') items.sort((a, b) => a.pricePaise - b.pricePaise)
  if (options.sort === 'price_desc') items.sort((a, b) => b.pricePaise - a.pricePaise)
  return { items, total }
}

/** Cards for a collection by handle, used by the Puck block. */
export async function collectionCards(
  tx: StoreTx,
  handle: string,
  limit: number,
): Promise<CardProduct[]> {
  const found = await getCollectionByHandle(tx, handle)
  if (!found) return []
  const { items } = await listCollectionProducts(tx, found.id, {
    sort: found.sortOrder,
    page: 1,
    perPage: limit,
  })
  return items
}
