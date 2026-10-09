import { notSystemTest } from '@commerce/core'
import type { StoreTx } from '@commerce/db'
import {
  inventoryAdjustment,
  inventoryLevel,
  media,
  product,
  productMedia,
  productOption,
  productOptionValue,
  sellableLevel,
  variant,
  variantOptionValue,
} from '@commerce/db'
import { and, asc, count, desc, eq, ilike, inArray, isNull, ne, or, sql } from 'drizzle-orm'

// Services are the only code that runs queries. They receive a store-scoped tx.

export type ProductStatus = 'draft' | 'active' | 'archived'

export type ProductListItem = {
  id: string
  handle: string
  title: string
  status: ProductStatus
  vendor: string | null
  productType: string | null
  imageUrl: string | null
  tags: string[]
  preorderEnabled: boolean
  launchAt: Date | null
  variantCount: number
  minPricePaise: number | null
  maxPricePaise: number | null
  available: number
}

export type ProductStockFilter = 'in' | 'out' | 'low'

export type ProductListInput = {
  page: number
  perPage: number
  search?: string | undefined
  status?: ProductStatus | undefined
  vendor?: string | undefined
  productType?: string | undefined
  tag?: string | undefined
  stock?: ProductStockFilter | undefined
  /** Ids only: the export route reuses the current filter without paging. */
  idsOnly?: boolean | undefined
}

/** At or below this count a tracked product counts as low stock. */
export const LOW_STOCK_AT = 5

function listWhere(input: ProductListInput) {
  return and(
    notSystemTest,
    input.search
      ? or(
          ilike(product.title, `%${input.search}%`),
          ilike(product.productType, `%${input.search}%`),
          ilike(product.vendor, `%${input.search}%`),
        )
      : undefined,
    input.status ? eq(product.status, input.status) : undefined,
    input.vendor ? eq(product.vendor, input.vendor) : undefined,
    input.productType ? eq(product.productType, input.productType) : undefined,
    input.tag ? sql`${input.tag} = ANY(${product.tags})` : undefined,
    input.stock
      ? sql`(
          select coalesce(sum(greatest(0, il.on_hand - il.reserved)), 0)
          from variant v left join inventory_level il on il.variant_id = v.id and il.fulfils_online
          where v.product_id = ${product.id} and v.archived_at is null
        ) ${
          input.stock === 'out'
            ? sql`= 0`
            : input.stock === 'low'
              ? sql`> 0 and (
                  select coalesce(sum(greatest(0, il.on_hand - il.reserved)), 0)
                  from variant v left join inventory_level il on il.variant_id = v.id and il.fulfils_online
                  where v.product_id = ${product.id} and v.archived_at is null
                ) <= ${LOW_STOCK_AT}`
              : sql`> 0`
        }`
      : undefined,
  )
}

/** Every product id matching the current filter, for export and select-all. */
export async function listProductIds(tx: StoreTx, input: ProductListInput): Promise<string[]> {
  const rows = await tx
    .select({ id: product.id })
    .from(product)
    .where(listWhere(input))
    .orderBy(desc(product.createdAt))
  return rows.map((r) => r.id)
}

export async function listProducts(
  tx: StoreTx,
  input: ProductListInput,
): Promise<{ items: ProductListItem[]; total: number }> {
  const where = listWhere(input)
  const [countRow] = await tx.select({ total: count() }).from(product).where(where)
  const total = countRow?.total ?? 0
  const rows = await tx
    .select()
    .from(product)
    .where(where)
    .orderBy(desc(product.createdAt))
    .limit(input.perPage)
    .offset((input.page - 1) * input.perPage)
  if (rows.length === 0) return { items: [], total }
  const ids = rows.map((r) => r.id)

  const variants = await tx
    .select({
      productId: variant.productId,
      pricePaise: variant.pricePaise,
      onHand: inventoryLevel.onHand,
      reserved: inventoryLevel.reserved,
    })
    .from(variant)
    .leftJoin(inventoryLevel, and(eq(inventoryLevel.variantId, variant.id), sellableLevel))
    .where(inArray(variant.productId, ids))
  const images = await tx
    .select({ productId: productMedia.productId, url: media.url })
    .from(productMedia)
    .innerJoin(media, eq(media.id, productMedia.mediaId))
    .where(and(inArray(productMedia.productId, ids), sql`${productMedia.position} = 0`))

  return {
    total,
    items: rows.map((r) => {
      const vs = variants.filter((v) => v.productId === r.id)
      return {
        id: r.id,
        handle: r.handle,
        title: r.title,
        status: r.status,
        vendor: r.vendor,
        productType: r.productType,
        imageUrl: images.find((i) => i.productId === r.id)?.url ?? null,
        tags: r.tags,
        preorderEnabled: r.preorderEnabled,
        launchAt: r.launchAt,
        variantCount: vs.length,
        minPricePaise: vs.length ? Math.min(...vs.map((v) => v.pricePaise)) : null,
        maxPricePaise: vs.length ? Math.max(...vs.map((v) => v.pricePaise)) : null,
        available: vs.reduce((n, v) => n + Math.max(0, (v.onHand ?? 0) - (v.reserved ?? 0)), 0),
      }
    }),
  }
}

export async function getProduct(tx: StoreTx, id: string) {
  const [p] = await tx.select().from(product).where(eq(product.id, id))
  if (!p) return null
  const variants = await tx
    .select({
      id: variant.id,
      title: variant.title,
      sku: variant.sku,
      barcode: variant.barcode,
      pricePaise: variant.pricePaise,
      mrpPaise: variant.mrpPaise,
      costPaise: variant.costPaise,
      taxable: variant.taxable,
      trackInventory: variant.trackInventory,
      weightGrams: variant.weightGrams,
      hsCode: variant.hsCode,
      countryOfOrigin: variant.countryOfOrigin,
      gstRatePercent: variant.gstRatePercent,
      boxPresetId: variant.boxPresetId,
      packageLengthCm: variant.packageLengthCm,
      packageWidthCm: variant.packageWidthCm,
      packageHeightCm: variant.packageHeightCm,
      mediaId: variant.mediaId,
      onHand: inventoryLevel.onHand,
      reserved: inventoryLevel.reserved,
    })
    .from(variant)
    .leftJoin(inventoryLevel, and(eq(inventoryLevel.variantId, variant.id), sellableLevel))
    .where(and(eq(variant.productId, id), isNull(variant.archivedAt)))
    .orderBy(asc(variant.position))
  const options = await tx
    .select()
    .from(productOption)
    .where(eq(productOption.productId, id))
    .orderBy(asc(productOption.position))
  const values = options.length
    ? await tx
        .select()
        .from(productOptionValue)
        .where(
          inArray(
            productOptionValue.optionId,
            options.map((o) => o.id),
          ),
        )
        .orderBy(asc(productOptionValue.position))
    : []
  const links = variants.length
    ? await tx
        .select()
        .from(variantOptionValue)
        .where(
          inArray(
            variantOptionValue.variantId,
            variants.map((v) => v.id),
          ),
        )
    : []
  const images = await tx
    .select({ id: media.id, url: media.url, alt: media.alt, contentType: media.contentType })
    .from(productMedia)
    .innerJoin(media, eq(media.id, productMedia.mediaId))
    .where(eq(productMedia.productId, id))
    .orderBy(asc(productMedia.position))
  const valueById = new Map(values.map((v) => [v.id, v]))
  return {
    ...p,
    images,
    options: options.map((o) => ({
      id: o.id,
      name: o.name,
      values: values.filter((v) => v.optionId === o.id).map((v) => ({ id: v.id, value: v.value })),
    })),
    variants: variants.map((v) => ({
      ...v,
      /** Values in option order, so the form can rebuild the matrix row. */
      optionValues: options.map(
        (o) =>
          links
            .filter((l) => l.variantId === v.id)
            .map((l) => valueById.get(l.optionValueId))
            .find((val) => val?.optionId === o.id)?.value ?? '',
      ),
    })),
  }
}

/** Distinct vendors, types and tags already used in the store, for autocomplete. */
export async function productFacets(tx: StoreTx) {
  const rows = await tx
    .select({ vendor: product.vendor, productType: product.productType, tags: product.tags })
    .from(product)
    .where(notSystemTest)
  const uniq = (xs: (string | null)[]) =>
    [...new Set(xs.filter((x): x is string => Boolean(x)))].sort((a, b) => a.localeCompare(b))
  return {
    vendors: uniq(rows.map((r) => r.vendor)),
    productTypes: uniq(rows.map((r) => r.productType)),
    tags: uniq(rows.flatMap((r) => r.tags)),
  }
}

export type ProductPatch = {
  title?: string | undefined
  handle?: string | undefined
  vendor?: string | null | undefined
  productType?: string | null | undefined
  status?: ProductStatus | undefined
}

export async function updateProduct(tx: StoreTx, id: string, patch: ProductPatch) {
  const set = Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined))
  const [row] = await tx
    .update(product)
    .set({ ...set, updatedAt: new Date() })
    .where(eq(product.id, id))
    .returning()
  return row ?? null
}

export type VariantPatch = {
  pricePaise?: number | undefined
  mrpPaise?: number | null | undefined
  sku?: string | null | undefined
  onHand?: number | undefined
}

export async function updateVariant(tx: StoreTx, id: string, patch: VariantPatch) {
  const { onHand, ...rest } = patch
  const variantPatch = Object.fromEntries(Object.entries(rest).filter(([, v]) => v !== undefined))
  if (Object.keys(variantPatch).length > 0) {
    await tx.update(variant).set(variantPatch).where(eq(variant.id, id))
  }
  if (onHand !== undefined) {
    await tx
      .update(inventoryLevel)
      .set({ onHand })
      .where(and(eq(inventoryLevel.variantId, id), sellableLevel))
  }
  const [row] = await tx.select().from(variant).where(eq(variant.id, id))
  return row ?? null
}

export type VariantSearchRow = {
  variantId: string
  productId: string
  title: string
  variantTitle: string
  sku: string | null
  pricePaise: number
  imageUrl: string | null
}

/** Variant picker for the draft order editor: one row per sellable variant. */
export async function searchVariants(
  tx: StoreTx,
  input: { search?: string | undefined; limit?: number | undefined },
): Promise<VariantSearchRow[]> {
  const search = input.search?.trim()
  return tx
    .select({
      variantId: variant.id,
      productId: product.id,
      title: product.title,
      variantTitle: variant.title,
      sku: variant.sku,
      pricePaise: variant.pricePaise,
      imageUrl: sql<string | null>`coalesce((
        select m.url from ${media} m where m.id = ${variant.mediaId}), (
        select m2.url from ${productMedia} pm join ${media} m2 on m2.id = pm.media_id
        where pm.product_id = ${product.id} order by pm.position limit 1))`,
    })
    .from(variant)
    .innerJoin(product, eq(product.id, variant.productId))
    .where(
      and(
        isNull(variant.archivedAt),
        ne(product.status, 'archived'),
        notSystemTest,
        search
          ? or(ilike(product.title, `%${search}%`), ilike(variant.sku, `%${search}%`))
          : undefined,
      ),
    )
    .orderBy(asc(product.title), asc(variant.position))
    .limit(input.limit ?? 20)
}

export type ProductStats = {
  total: number
  active: number
  draft: number
  /** Selling products with 1 to LOW_STOCK_AT units left. */
  lowStock: number
  outOfStock: number
  stockValuePaise: number
}

/** Tiles above the list: counts plus what the stock on hand is worth at cost. */
export async function productStats(tx: StoreTx): Promise<ProductStats> {
  const [counts] = await tx
    .select({
      total: count(),
      active: sql<number>`count(*) filter (where ${product.status} = 'active')`,
      draft: sql<number>`count(*) filter (where ${product.status} = 'draft')`,
    })
    .from(product)
    .where(notSystemTest)
  const [stock] = await tx
    .select({
      value: sql<number>`coalesce(sum(greatest(0, ${inventoryLevel.onHand}) * coalesce(${variant.costPaise}, ${variant.pricePaise})), 0)`,
    })
    .from(variant)
    .innerJoin(product, eq(product.id, variant.productId))
    .leftJoin(inventoryLevel, and(eq(inventoryLevel.variantId, variant.id), sellableLevel))
    .where(and(isNull(variant.archivedAt), notSystemTest))
  const [out] = await tx
    .select({ n: sql<number>`count(*)` })
    .from(product)
    .where(
      and(
        notSystemTest,
        sql`(
        select coalesce(sum(greatest(0, il.on_hand - il.reserved)), 0)
        from variant v left join inventory_level il on il.variant_id = v.id and il.fulfils_online
        where v.product_id = ${product.id} and v.archived_at is null
      ) = 0`,
      ),
    )
  const [low] = await tx
    .select({ n: sql<number>`count(*)` })
    .from(product)
    .where(
      and(
        notSystemTest,
        sql`(
        select coalesce(sum(greatest(0, il.on_hand - il.reserved)), 0)
        from variant v left join inventory_level il on il.variant_id = v.id and il.fulfils_online
        where v.product_id = ${product.id} and v.archived_at is null
      ) between 1 and ${LOW_STOCK_AT}`,
      ),
    )
  return {
    total: counts?.total ?? 0,
    active: Number(counts?.active ?? 0),
    draft: Number(counts?.draft ?? 0),
    lowStock: Number(low?.n ?? 0),
    outOfStock: Number(out?.n ?? 0),
    stockValuePaise: Number(stock?.value ?? 0),
  }
}

export type AdjustmentRow = {
  id: string
  variantTitle: string
  delta: number
  reason: string
  note: string | null
  createdAt: Date
}

/** Recent stock movements for one product, newest first. */
export async function productAdjustments(
  tx: StoreTx,
  productId: string,
  limit = 20,
): Promise<AdjustmentRow[]> {
  const rows = await tx
    .select({
      id: inventoryAdjustment.id,
      variantTitle: variant.title,
      delta: inventoryAdjustment.delta,
      reason: inventoryAdjustment.reason,
      note: inventoryAdjustment.note,
      createdAt: inventoryAdjustment.createdAt,
    })
    .from(inventoryAdjustment)
    .innerJoin(variant, eq(variant.id, inventoryAdjustment.variantId))
    .where(eq(variant.productId, productId))
    .orderBy(desc(inventoryAdjustment.createdAt))
    .limit(limit)
  return rows
}

/** Handles already in the store, so the import preview can say create or update. */
export async function listProductHandles(tx: StoreTx): Promise<string[]> {
  const rows = await tx.select({ handle: product.handle }).from(product)
  return rows.map((r) => r.handle)
}

export type PickProductVariant = {
  id: string
  title: string
  sku: string | null
  pricePaise: number
  available: number
}

export type PickProductRow = {
  id: string
  title: string
  status: ProductStatus
  imageUrl: string | null
  sku: string | null
  pricePaiseMin: number | null
  pricePaiseMax: number | null
  available: number
  variants: PickProductVariant[]
}

export type PickProductsInput = {
  search?: string | undefined
  collectionId?: string | undefined
  productType?: string | undefined
  status?: ProductStatus | undefined
  limit: number
}

/** Rows for the "Select products" dialog: each product with its variants so the dialog can expand them. */
export async function pickProducts(
  tx: StoreTx,
  input: PickProductsInput,
): Promise<PickProductRow[]> {
  const search = input.search?.trim()
  const rows = await tx
    .select({
      id: product.id,
      title: product.title,
      status: product.status,
      imageUrl: sql<string | null>`(
        select m.url from ${productMedia} pm join ${media} m on m.id = pm.media_id
        where pm.product_id = product.id order by pm.position limit 1)`,
    })
    .from(product)
    .where(
      and(
        notSystemTest,
        input.status ? eq(product.status, input.status) : ne(product.status, 'archived'),
        input.productType ? eq(product.productType, input.productType) : undefined,
        input.collectionId
          ? sql`exists (select 1 from collection_product cp where cp.product_id = ${product.id} and cp.collection_id = ${input.collectionId})`
          : undefined,
        search
          ? or(
              ilike(product.title, `%${search}%`),
              sql`exists (select 1 from variant v where v.product_id = ${product.id} and v.sku ilike ${`%${search}%`})`,
            )
          : undefined,
      ),
    )
    .orderBy(asc(product.title))
    .limit(input.limit)
  if (rows.length === 0) return []

  const variants = await tx
    .select({
      id: variant.id,
      productId: variant.productId,
      title: variant.title,
      sku: variant.sku,
      pricePaise: variant.pricePaise,
      onHand: inventoryLevel.onHand,
      reserved: inventoryLevel.reserved,
    })
    .from(variant)
    .leftJoin(inventoryLevel, and(eq(inventoryLevel.variantId, variant.id), sellableLevel))
    .where(
      and(
        inArray(
          variant.productId,
          rows.map((r) => r.id),
        ),
        isNull(variant.archivedAt),
      ),
    )
    .orderBy(asc(variant.position))

  return rows.map((r) => {
    const vs = variants
      .filter((v) => v.productId === r.id)
      .map((v) => ({
        id: v.id,
        title: v.title,
        sku: v.sku,
        pricePaise: v.pricePaise,
        available: Math.max(0, (v.onHand ?? 0) - (v.reserved ?? 0)),
      }))
    return {
      ...r,
      sku: vs[0]?.sku ?? null,
      pricePaiseMin: vs.length ? Math.min(...vs.map((v) => v.pricePaise)) : null,
      pricePaiseMax: vs.length ? Math.max(...vs.map((v) => v.pricePaise)) : null,
      available: vs.reduce((n, v) => n + v.available, 0),
      variants: vs,
    }
  })
}
