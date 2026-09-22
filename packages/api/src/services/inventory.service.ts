import type { StoreTx } from '@commerce/db'
import {
  inventoryAdjustment,
  inventoryLevel,
  media,
  product,
  productMedia,
  store,
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

export type StockFilter = 'all' | 'in' | 'low' | 'out'

export type InventoryQuery = {
  locationId: string
  search?: string | undefined
  stock?: StockFilter | undefined
  vendor?: string | undefined
  productType?: string | undefined
  sort?: 'product' | 'available_asc' | 'available_desc' | undefined
  page: number
  perPage: number
}

export type InventoryRow = {
  variantId: string
  productId: string
  productTitle: string
  variantTitle: string
  sku: string | null
  imageUrl: string | null
  onHand: number
  committed: number
  available: number
  incoming: number
  costPaise: number | null
}

async function threshold(tx: StoreTx): Promise<number> {
  const [row] = await tx.select({ n: store.lowStockThreshold }).from(store).limit(1)
  return row?.n ?? 5
}

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
    q.stock === 'out' ? sql`${availableSql} <= 0` : undefined,
    q.stock === 'low' ? sql`${availableSql} > 0 and ${availableSql} <= ${low}` : undefined,
    q.stock === 'in' ? sql`${availableSql} > ${low}` : undefined,
  ]
  return and(...conditions) as SQL
}

function joinLevel(locationId: string) {
  return and(eq(inventoryLevel.variantId, variant.id), eq(inventoryLevel.locationId, locationId))
}

async function imagesFor(
  tx: StoreTx,
  rows: { variantId: string; productId: string; mediaId: string | null }[],
): Promise<Map<string, string>> {
  const out = new Map<string, string>()
  if (rows.length === 0) return out
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
  return out
}

export async function listInventory(
  tx: StoreTx,
  q: InventoryQuery,
): Promise<{ rows: InventoryRow[]; total: number }> {
  const low = await threshold(tx)
  const where = baseWhere(q, low)
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
      imageUrl: images.get(r.variantId) ?? null,
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

/** Distinct vendors and types for the filter popover. */
export async function inventoryFacets(tx: StoreTx) {
  const vendors = await tx
    .selectDistinct({ v: product.vendor })
    .from(product)
    .where(sql`${product.vendor} is not null and ${product.vendor} <> ''`)
    .orderBy(asc(product.vendor))
  const types = await tx
    .selectDistinct({ t: product.productType })
    .from(product)
    .where(sql`${product.productType} is not null and ${product.productType} <> ''`)
    .orderBy(asc(product.productType))
  return {
    vendors: vendors.map((r) => r.v as string),
    types: types.map((r) => r.t as string),
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
        : and(eq(inventoryLevel.variantId, variant.id), eq(inventoryLevel.fulfilsOnline, true)),
    )
    .where(
      and(
        isNull(variant.archivedAt),
        ne(product.status, 'archived'),
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
    imageUrl: images.get(r.variantId) ?? null,
  }))
}
