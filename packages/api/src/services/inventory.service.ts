import {
  type StockFilter as CoreStockFilter,
  notSystemTest,
  storeLowStockThreshold,
} from '@commerce/core'
import type { StoreTx } from '@commerce/db'
import {
  collection,
  inventoryAdjustment,
  inventoryLevel,
  media,
  primarySellingLevel,
  product,
  productMedia,
  variant,
} from '@commerce/db'
import {
  and,
  asc,
  count,
  desc,
  eq,
  ilike,
  inArray,
  isNull,
  ne,
  or,
  type SQL,
  sql,
} from 'drizzle-orm'

// Services are the only code that runs queries. They receive a store-scoped tx.

/** A `?stock=` filter, or every row. */
export type StockFilter = 'all' | CoreStockFilter

export type InventoryQuery = {
  locationId: string
  search?: string | undefined
  stock?: StockFilter | undefined
  vendor?: string | undefined
  productType?: string | undefined
  vendors?: string[] | undefined
  productTypes?: string[] | undefined
  tags?: string[] | undefined
  collectionIds?: string[] | undefined
  /** Archived products never show here, so active and draft. */
  productStatus?: ('active' | 'draft')[] | undefined
  /** When stock last changed at this location (`STOCK_CHANGED_FILTERS`). */
  changed?: StockChangedFilter | undefined
  /** `product`: a page is products, each with all its matching variants. */
  group?: 'variant' | 'product' | undefined
  sort?: 'product' | 'available_asc' | 'available_desc' | undefined
  page: number
  perPage: number
}

/** "Stock changed" filter: within the last N days, or not for over 90 days (or never). */
export const STOCK_CHANGED_FILTERS = ['1d', '7d', '30d', '90d', 'stale'] as const
export type StockChangedFilter = (typeof STOCK_CHANGED_FILTERS)[number]

const CHANGED_DAYS: Record<Exclude<StockChangedFilter, 'stale'>, number> = {
  '1d': 1,
  '7d': 7,
  '30d': 30,
  '90d': 90,
}

/** A stock change for this variant at the location within `days` days. */
function changedWithin(locationId: string, days: number): SQL {
  return sql`exists (select 1 from ${inventoryAdjustment} a where a.variant_id = ${variant.id}
    and (a.location_id = ${locationId} or a.location_id is null)
    and a.created_at >= now() - make_interval(days => ${days}))`
}

export type InventoryRow = {
  variantId: string
  productId: string
  productTitle: string
  variantTitle: string
  sku: string | null
  /** Hidden on the storefront (#934): the tree shows a "Hidden" chip. */
  hiddenOnStore: boolean
  imageUrl: string | null
  /** The product's cover, for the one row a product gets in the Products view. */
  productImageUrl: string | null
  onHand: number
  committed: number
  available: number
  incoming: number
  costPaise: number | null
}

const threshold = (tx: StoreTx) => storeLowStockThreshold(tx)

/* Level at the chosen location; a variant with no row there reads as zero. */
const onHandSql = sql<number>`coalesce(${inventoryLevel.onHand}, 0)`.mapWith(Number)
const reservedSql = sql<number>`coalesce(${inventoryLevel.reserved}, 0)`.mapWith(Number)
const incomingSql = sql<number>`coalesce(${inventoryLevel.incoming}, 0)`.mapWith(Number)
const availableSql = sql<number>`coalesce(${inventoryLevel.onHand}, 0) - coalesce(${inventoryLevel.reserved}, 0)`

function baseWhere(q: Omit<InventoryQuery, 'page' | 'perPage' | 'sort'>, low: number): SQL {
  const term = q.search?.trim()
  const conditions: (SQL | undefined)[] = [
    isNull(variant.archivedAt),
    eq(variant.trackInventory, true),
    ne(product.status, 'archived'),
    term
      ? or(
          ilike(product.title, `%${term}%`),
          ilike(variant.title, `%${term}%`),
          ilike(variant.sku, `%${term}%`),
        )
      : undefined,
    q.vendor ? eq(product.vendor, q.vendor) : undefined,
    q.productType ? eq(product.productType, q.productType) : undefined,
    q.vendors?.length ? inArray(product.vendor, q.vendors) : undefined,
    q.productTypes?.length ? inArray(product.productType, q.productTypes) : undefined,
    q.tags?.length ? sql`${product.tags} && ${sql.param(q.tags)}::text[]` : undefined,
    q.collectionIds?.length
      ? sql`exists (
          select 1 from collection_product cp
          where cp.product_id = ${product.id}
            and cp.collection_id = any(${sql.param(q.collectionIds)}::uuid[])
        )`
      : undefined,
    q.productStatus?.length ? inArray(product.status, q.productStatus) : undefined,
    q.stock === 'out' ? sql`${availableSql} <= 0` : undefined,
    q.stock === 'low' ? sql`${availableSql} > 0 and ${availableSql} <= ${low}` : undefined,
    q.stock === 'in' ? sql`${availableSql} > ${low}` : undefined,
    q.changed === 'stale'
      ? sql`not ${changedWithin(q.locationId, 90)}`
      : q.changed
        ? changedWithin(q.locationId, CHANGED_DAYS[q.changed])
        : undefined,
  ]
  return and(...conditions) as SQL
}

function joinLevel(locationId: string) {
  return and(eq(inventoryLevel.variantId, variant.id), eq(inventoryLevel.locationId, locationId))
}

/** Each variant's own image (else its product's cover), and each product's cover. */
async function imagesFor(
  tx: StoreTx,
  rows: { variantId: string; productId: string; mediaId: string | null }[],
): Promise<{ byVariant: Map<string, string>; byProduct: Map<string, string> }> {
  const out = new Map<string, string>()
  if (rows.length === 0) return { byVariant: out, byProduct: new Map() }
  const variantMedia = rows.map((r) => r.mediaId).filter((id): id is string => id !== null)
  const own = variantMedia.length
    ? await tx
        .select({ id: media.id, url: media.url })
        .from(media)
        .where(inArray(media.id, variantMedia))
    : []
  const ownById = new Map(own.map((m) => [m.id, m.url]))
  const covers = await tx
    .select({ productId: productMedia.productId, url: media.url })
    .from(productMedia)
    .innerJoin(media, eq(media.id, productMedia.mediaId))
    .where(
      and(
        inArray(productMedia.productId, [...new Set(rows.map((r) => r.productId))]),
        eq(productMedia.position, 0),
      ),
    )
  const coverByProduct = new Map(covers.map((c) => [c.productId, c.url]))
  for (const r of rows) {
    const url = (r.mediaId && ownById.get(r.mediaId)) || coverByProduct.get(r.productId)
    if (url) out.set(r.variantId, url)
  }
  return { byVariant: out, byProduct: coverByProduct }
}

export async function listInventory(
  tx: StoreTx,
  q: InventoryQuery,
): Promise<{ rows: InventoryRow[]; total: number }> {
  const low = await threshold(tx)
  const where = baseWhere(q, low)
  if (q.group === 'product') return listInventoryByProduct(tx, q, where)
  const order =
    q.sort === 'available_asc'
      ? [asc(availableSql), asc(product.title)]
      : q.sort === 'available_desc'
        ? [desc(availableSql), asc(product.title)]
        : [asc(product.title), asc(variant.position)]
  const found = await tx
    .select({
      variantId: variant.id,
      productId: product.id,
      productTitle: product.title,
      variantTitle: variant.title,
      sku: variant.sku,
      hiddenOnStore: variant.hiddenOnStore,
      mediaId: variant.mediaId,
      costPaise: variant.costPaise,
      onHand: onHandSql,
      committed: reservedSql,
      incoming: incomingSql,
    })
    .from(variant)
    .innerJoin(product, eq(product.id, variant.productId))
    .leftJoin(inventoryLevel, joinLevel(q.locationId))
    .where(where)
    .orderBy(...order)
    .limit(q.perPage)
    .offset((q.page - 1) * q.perPage)
  const [total] = await tx
    .select({ n: count() })
    .from(variant)
    .innerJoin(product, eq(product.id, variant.productId))
    .leftJoin(inventoryLevel, joinLevel(q.locationId))
    .where(where)
  const images = await imagesFor(tx, found)
  return {
    rows: found.map(({ mediaId: _m, ...r }) => ({
      ...r,
      available: r.onHand - r.committed,
      imageUrl: images.byVariant.get(r.variantId) ?? null,
      productImageUrl: images.byProduct.get(r.productId) ?? null,
    })),
    total: Number(total?.n ?? 0),
  }
}

/**
 * A page of products (A to Z) with every matching variant of each, so a product's SKUs sit
 * together and are edited one by one. `total` counts products.
 */
async function listInventoryByProduct(
  tx: StoreTx,
  q: InventoryQuery,
  where: SQL,
): Promise<{ rows: InventoryRow[]; total: number }> {
  const products = await tx
    .selectDistinct({ id: product.id, title: product.title })
    .from(variant)
    .innerJoin(product, eq(product.id, variant.productId))
    .leftJoin(inventoryLevel, joinLevel(q.locationId))
    .where(where)
    .orderBy(asc(product.title), asc(product.id))
    .limit(q.perPage)
    .offset((q.page - 1) * q.perPage)
  const [total] = await tx
    .select({ n: sql<number>`count(distinct ${product.id})`.mapWith(Number) })
    .from(variant)
    .innerJoin(product, eq(product.id, variant.productId))
    .leftJoin(inventoryLevel, joinLevel(q.locationId))
    .where(where)
  if (products.length === 0) return { rows: [], total: Number(total?.n ?? 0) }
  const found = await tx
    .select({
      variantId: variant.id,
      productId: product.id,
      productTitle: product.title,
      variantTitle: variant.title,
      sku: variant.sku,
      hiddenOnStore: variant.hiddenOnStore,
      mediaId: variant.mediaId,
      costPaise: variant.costPaise,
      onHand: onHandSql,
      committed: reservedSql,
      incoming: incomingSql,
    })
    .from(variant)
    .innerJoin(product, eq(product.id, variant.productId))
    .leftJoin(inventoryLevel, joinLevel(q.locationId))
    .where(
      and(
        where,
        inArray(
          product.id,
          products.map((p) => p.id),
        ),
      ),
    )
    .orderBy(asc(product.title), asc(product.id), asc(variant.position))
  const images = await imagesFor(tx, found)
  return {
    rows: found.map(({ mediaId: _m, ...r }) => ({
      ...r,
      available: r.onHand - r.committed,
      imageUrl: images.byVariant.get(r.variantId) ?? null,
      productImageUrl: images.byProduct.get(r.productId) ?? null,
    })),
    total: Number(total?.n ?? 0),
  }
}

export async function inventoryStats(tx: StoreTx, locationId: string) {
  const low = await threshold(tx)
  const tracked = and(
    isNull(variant.archivedAt),
    eq(variant.trackInventory, true),
    ne(product.status, 'archived'),
  )
  const [row] = await tx
    .select({
      skus: count(),
      out: sql<number>`count(*) filter (where ${availableSql} <= 0)`.mapWith(Number),
      low: sql<number>`count(*) filter (where ${availableSql} > 0 and ${availableSql} <= ${low})`.mapWith(
        Number,
      ),
      valuePaise:
        sql<number>`coalesce(sum(greatest(0, coalesce(${inventoryLevel.onHand}, 0)) * coalesce(${variant.costPaise}, ${variant.pricePaise})), 0)`.mapWith(
          Number,
        ),
    })
    .from(variant)
    .innerJoin(product, eq(product.id, variant.productId))
    .leftJoin(inventoryLevel, joinLevel(locationId))
    .where(tracked)
  return {
    skus: Number(row?.skus ?? 0),
    outOfStock: row?.out ?? 0,
    lowStock: row?.low ?? 0,
    valuePaise: row?.valuePaise ?? 0,
    lowThreshold: low,
  }
}

/** Every stock change for one variant, newest first. */
export async function inventoryHistory(
  tx: StoreTx,
  variantId: string,
  locationId?: string | undefined,
) {
  return tx
    .select({
      id: inventoryAdjustment.id,
      delta: inventoryAdjustment.delta,
      reason: inventoryAdjustment.reason,
      note: inventoryAdjustment.note,
      locationId: inventoryAdjustment.locationId,
      createdAt: inventoryAdjustment.createdAt,
    })
    .from(inventoryAdjustment)
    .where(
      and(
        eq(inventoryAdjustment.variantId, variantId),
        locationId
          ? or(
              eq(inventoryAdjustment.locationId, locationId),
              isNull(inventoryAdjustment.locationId),
            )
          : undefined,
      ),
    )
    .orderBy(desc(inventoryAdjustment.createdAt))
    .limit(100)
}

/** Distinct vendors, types and tags, and the collections, for the filter popover. */
export async function inventoryFacets(tx: StoreTx) {
  const vendors = await tx
    .selectDistinct({ v: product.vendor })
    .from(product)
    .where(and(notSystemTest, sql`${product.vendor} is not null and ${product.vendor} <> ''`))
    .orderBy(asc(product.vendor))
  const types = await tx
    .selectDistinct({ t: product.productType })
    .from(product)
    .where(
      and(notSystemTest, sql`${product.productType} is not null and ${product.productType} <> ''`),
    )
    .orderBy(asc(product.productType))
  const tags = await tx
    .selectDistinct({ t: sql<string>`unnest(${product.tags})` })
    .from(product)
    .where(notSystemTest)
    .orderBy(sql`1`)
  const collections = await tx
    .select({ id: collection.id, title: collection.title })
    .from(collection)
    .orderBy(asc(collection.title))
  return {
    vendors: vendors.map((r) => r.v as string),
    types: types.map((r) => r.t as string),
    tags: tags.map((r) => r.t).filter(Boolean),
    collections,
  }
}

/** Variants matching a search, for the purchase order and transfer pickers. */
export async function searchVariants(
  tx: StoreTx,
  input: { search?: string | undefined; locationId?: string | undefined; limit: number },
) {
  const term = input.search?.trim()
  const found = await tx
    .select({
      variantId: variant.id,
      productId: product.id,
      productTitle: product.title,
      variantTitle: variant.title,
      sku: variant.sku,
      hiddenOnStore: variant.hiddenOnStore,
      mediaId: variant.mediaId,
      costPaise: variant.costPaise,
      onHand: onHandSql,
      committed: reservedSql,
    })
    .from(variant)
    .innerJoin(product, eq(product.id, variant.productId))
    .leftJoin(
      inventoryLevel,
      input.locationId
        ? joinLevel(input.locationId)
        : and(eq(inventoryLevel.variantId, variant.id), primarySellingLevel(variant.id)),
    )
    .where(
      and(
        isNull(variant.archivedAt),
        ne(product.status, 'archived'),
        notSystemTest,
        term
          ? or(
              ilike(product.title, `%${term}%`),
              ilike(variant.title, `%${term}%`),
              ilike(variant.sku, `%${term}%`),
            )
          : undefined,
      ),
    )
    .orderBy(asc(product.title), asc(variant.position))
    .limit(input.limit)
  const images = await imagesFor(tx, found)
  return found.map(({ mediaId: _m, ...r }) => ({
    ...r,
    available: r.onHand - r.committed,
    imageUrl: images.byVariant.get(r.variantId) ?? null,
  }))
}
