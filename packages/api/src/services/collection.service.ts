import { notSystemTest } from '@commerce/core'
import type { StoreTx } from '@commerce/db'
import { collection, collectionProduct, media, product, productMedia, variant } from '@commerce/db'
import { and, asc, count, desc, eq, ilike, inArray, sql } from 'drizzle-orm'

// Services are the only code that runs queries. They receive a store-scoped tx.

export type CollectionKind = 'manual' | 'automatic'
export type CollectionStatus = 'draft' | 'active'

export type CollectionListItem = {
  id: string
  handle: string
  title: string
  kind: CollectionKind
  status: CollectionStatus
  imageUrl: string | null
  productCount: number
  updatedAt: Date
}

/** Counts per collection in one pass, so the list does not fan out per row. */
async function countsByCollection(tx: StoreTx, ids: string[]): Promise<Map<string, number>> {
  const out = new Map<string, number>()
  if (ids.length === 0) return out
  const rows = await tx
    .select({ collectionId: collectionProduct.collectionId, n: count() })
    .from(collectionProduct)
    .where(inArray(collectionProduct.collectionId, ids))
    .groupBy(collectionProduct.collectionId)
  for (const row of rows) out.set(row.collectionId, Number(row.n))
  return out
}

export async function listCollections(tx: StoreTx): Promise<CollectionListItem[]> {
  const rows = await tx
    .select({
      id: collection.id,
      handle: collection.handle,
      title: collection.title,
      kind: collection.kind,
      status: collection.status,
      updatedAt: collection.updatedAt,
      imageUrl: media.url,
    })
    .from(collection)
    .leftJoin(media, eq(media.id, collection.imageMediaId))
    .orderBy(asc(collection.title))
  const counts = await countsByCollection(
    tx,
    rows.map((r) => r.id),
  )
  return rows.map((r) => ({ ...r, productCount: counts.get(r.id) ?? 0 }))
}

export type CollectionStats = {
  total: number
  automatic: number
  manual: number
  empty: number
}

export async function collectionStats(tx: StoreTx): Promise<CollectionStats> {
  const rows = await listCollections(tx)
  return {
    total: rows.length,
    automatic: rows.filter((r) => r.kind === 'automatic').length,
    manual: rows.filter((r) => r.kind === 'manual').length,
    empty: rows.filter((r) => r.productCount === 0).length,
  }
}

export async function getCollection(tx: StoreTx, id: string) {
  const [row] = await tx.select().from(collection).where(eq(collection.id, id))
  if (!row) return null
  const members = await tx
    .select({
      id: product.id,
      title: product.title,
      handle: product.handle,
      status: product.status,
      position: collectionProduct.position,
      imageUrl: media.url,
    })
    .from(collectionProduct)
    .innerJoin(product, eq(product.id, collectionProduct.productId))
    .leftJoin(
      productMedia,
      and(eq(productMedia.productId, product.id), eq(productMedia.position, 0)),
    )
    .leftJoin(media, eq(media.id, productMedia.mediaId))
    .where(eq(collectionProduct.collectionId, id))
    .orderBy(asc(collectionProduct.position))
  const [image] = row.imageMediaId
    ? await tx.select({ url: media.url }).from(media).where(eq(media.id, row.imageMediaId))
    : []
  return { ...row, imageUrl: image?.url ?? null, products: members }
}

export type CollectionProductRow = {
  id: string
  title: string
  handle: string
  imageUrl: string | null
  createdAt: Date
  /** Units sold is not tracked per product yet; this is stock on hand. */
  available: number
  status: 'draft' | 'active' | 'archived'
  featured: boolean
}

export type CollectionProductsInput = {
  collectionId?: string | undefined
  search?: string | undefined
  /** Frame tabs: all products, featured, on sale, out of stock. */
  tab?: 'all' | 'featured' | 'onSale' | 'outOfStock' | undefined
  page: number
  perPage: number
}

const availableSql = sql<number>`(
  select coalesce(sum(greatest(0, il.on_hand - il.reserved)), 0)
  from variant v left join inventory_level il on il.variant_id = v.id and il.fulfils_online
  where v.product_id = ${product.id} and v.archived_at is null
)`

const onSaleSql = sql`exists (
  select 1 from variant v
  where v.product_id = ${product.id} and v.archived_at is null
    and v.mrp_paise is not null and v.mrp_paise > v.price_paise
)`

function productsWhere(input: CollectionProductsInput) {
  return and(
    notSystemTest,
    input.collectionId
      ? sql`exists (select 1 from collection_product cp where cp.product_id = ${product.id} and cp.collection_id = ${input.collectionId})`
      : undefined,
    input.search ? ilike(product.title, `%${input.search}%`) : undefined,
    input.tab === 'featured' ? sql`'featured' = ANY(${product.tags})` : undefined,
    input.tab === 'onSale' ? onSaleSql : undefined,
    input.tab === 'outOfStock' ? sql`${availableSql} = 0` : undefined,
  )
}

/** The table under the category cards: products, optionally narrowed to one collection. */
export async function listCollectionProducts(
  tx: StoreTx,
  input: CollectionProductsInput,
): Promise<{ items: CollectionProductRow[]; total: number }> {
  const where = productsWhere(input)
  const [countRow] = await tx.select({ total: count() }).from(product).where(where)
  const total = countRow?.total ?? 0
  const rows = await tx
    .select({
      id: product.id,
      title: product.title,
      handle: product.handle,
      status: product.status,
      tags: product.tags,
      createdAt: product.createdAt,
      available: availableSql,
      imageUrl: media.url,
    })
    .from(product)
    .leftJoin(
      productMedia,
      and(eq(productMedia.productId, product.id), eq(productMedia.position, 0)),
    )
    .leftJoin(media, eq(media.id, productMedia.mediaId))
    .where(where)
    .orderBy(desc(product.createdAt))
    .limit(input.perPage)
    .offset((input.page - 1) * input.perPage)
  return {
    total,
    items: rows.map((r) => ({
      id: r.id,
      title: r.title,
      handle: r.handle,
      imageUrl: r.imageUrl,
      createdAt: r.createdAt,
      available: Number(r.available ?? 0),
      status: r.status,
      featured: r.tags.includes('featured'),
    })),
  }
}

/** Product picker for a manual collection's editor. */
export async function searchProducts(tx: StoreTx, search: string, limit = 20) {
  const rows = await tx
    .select({
      id: product.id,
      title: product.title,
      status: product.status,
      imageUrl: media.url,
      pricePaise: sql<
        number | null
      >`(select min(${variant.pricePaise}) from ${variant} where ${variant.productId} = ${product.id} and ${variant.archivedAt} is null)`,
    })
    .from(product)
    .leftJoin(
      productMedia,
      and(eq(productMedia.productId, product.id), eq(productMedia.position, 0)),
    )
    .leftJoin(media, eq(media.id, productMedia.mediaId))
    .where(and(notSystemTest, search ? ilike(product.title, `%${search}%`) : undefined))
    .orderBy(asc(product.title))
    .limit(limit)
  return rows.map((r) => ({
    ...r,
    pricePaise: r.pricePaise === null ? null : Number(r.pricePaise),
  }))
}

/** Storefront: one collection with its products, sorted as the merchant chose. */
export async function collectionByHandle(tx: StoreTx, handle: string) {
  const [row] = await tx
    .select()
    .from(collection)
    .where(and(eq(collection.handle, handle), eq(collection.status, 'active')))
  if (!row) return null
  const [image] = row.imageMediaId
    ? await tx.select({ url: media.url }).from(media).where(eq(media.id, row.imageMediaId))
    : []
  return { ...row, imageUrl: image?.url ?? null }
}

export async function activeCollections(tx: StoreTx) {
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
  const counts = await countsByCollection(
    tx,
    rows.map((r) => r.id),
  )
  return rows.map((r) => ({ ...r, productCount: counts.get(r.id) ?? 0 }))
}
