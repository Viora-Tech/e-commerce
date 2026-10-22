import {
  DEFAULT_GST_RATE_PERCENT,
  LOW_STOCK_THRESHOLD,
  noteProductsChanged,
  notSystemTest,
  onHandleChange,
  parseStoreTax,
  type StockFilter,
  storeLowStockThreshold,
} from '@commerce/core'
import type { StoreTx } from '@commerce/db'
import {
  inventoryLevel,
  media,
  primarySellingLevel,
  product,
  productMedia,
  productOption,
  productOptionValue,
  sellableStock,
  store,
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

export type ProductStockFilter = StockFilter

export type ProductListInput = {
  page: number
  perPage: number
  search?: string | undefined
  status?: ProductStatus | undefined
  vendor?: string | undefined
  productType?: string | undefined
  tag?: string | undefined
  stock?: ProductStockFilter | undefined
  ids?: string[] | undefined
  /** Ids only: the export route reuses the current filter without paging. */
  idsOnly?: boolean | undefined
}

/** `lowThreshold` is the store's (`storeLowStockThreshold`), for the `low` stock filter. */
function listWhere(input: ProductListInput, lowThreshold: number) {
  return and(
    notSystemTest,
    input.search
      ? or(
          ilike(product.title, `%${input.search}%`),
          ilike(product.productType, `%${input.search}%`),
          ilike(product.vendor, `%${input.search}%`),
        )
      : undefined,
    input.ids ? inArray(product.id, input.ids) : undefined,
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
                ) <= ${lowThreshold}`
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
    .where(listWhere(input, await storeLowStockThreshold(tx)))
    .orderBy(desc(product.createdAt))
  return rows.map((r) => r.id)
}

export async function listProducts(
  tx: StoreTx,
  input: ProductListInput,
): Promise<{ items: ProductListItem[]; total: number }> {
  const where = listWhere(input, await storeLowStockThreshold(tx))
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
      onHand: sellableStock.onHand,
      reserved: sellableStock.reserved,
    })
    .from(variant)
    .leftJoin(sellableStock, eq(sellableStock.variantId, variant.id))
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
      weightUnit: variant.weightUnit,
      hsCode: variant.hsCode,
      countryOfOrigin: variant.countryOfOrigin,
      gstRatePercent: variant.gstRatePercent,
      boxPresetId: variant.boxPresetId,
      packageLengthCm: variant.packageLengthCm,
      packageWidthCm: variant.packageWidthCm,
      packageHeightCm: variant.packageHeightCm,
      mediaId: variant.mediaId,
      onHand: sellableStock.onHand,
      reserved: sellableStock.reserved,
    })
    .from(variant)
    .leftJoin(sellableStock, eq(sellableStock.variantId, variant.id))
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
/** Most option names (and values per name) offered as suggestions on the product page. */
const OPTION_FACETS_MAX = 50

/**
 * Values already in use across the store, offered as suggestions on the product page, plus the
 * store's GST defaults so the pricing card can show what the customer pays.
 */
export async function productFacets(tx: StoreTx, storeId: string) {
  const rows = await tx
    .select({ vendor: product.vendor, productType: product.productType, tags: product.tags })
    .from(product)
    .where(notSystemTest)
  const optionRows = await tx
    .select({ name: productOption.name, value: productOptionValue.value })
    .from(productOptionValue)
    .innerJoin(productOption, eq(productOption.id, productOptionValue.optionId))
    .orderBy(asc(productOption.name), asc(productOptionValue.position))
  const [storeRow] = await tx
    .select({
      gstRatePercent: store.gstRatePercent,
      apps: store.apps,
      lowStockThreshold: store.lowStockThreshold,
    })
    .from(store)
    .where(eq(store.id, storeId))
  const uniq = (xs: (string | null)[]) =>
    [...new Set(xs.filter((x): x is string => Boolean(x)))].sort((a, b) => a.localeCompare(b))
  return {
    vendors: uniq(rows.map((r) => r.vendor)),
    productTypes: uniq(rows.map((r) => r.productType)),
    tags: uniq(rows.flatMap((r) => r.tags)),
    options: optionFacets(optionRows),
    gst: {
      ratePercent: storeRow?.gstRatePercent ?? DEFAULT_GST_RATE_PERCENT,
      composition: storeRow ? parseStoreTax(storeRow.apps).composition : false,
    },
    /** Where "low stock" starts for this store, so the admin's chips match the list filters. */
    lowStockThreshold: storeRow?.lowStockThreshold ?? LOW_STOCK_THRESHOLD,
  }
}

/** Option names used across the store, merged case-insensitively, each with its distinct values. */
function optionFacets(rows: { name: string; value: string }[]) {
  const byName = new Map<string, { name: string; values: string[] }>()
  for (const { name, value } of rows) {
    const key = name.trim().toLowerCase()
    if (!key) continue
    const entry = byName.get(key) ?? { name: name.trim(), values: [] }
    byName.set(key, entry)
    const v = value.trim()
    const seen = entry.values.some((x) => x.toLowerCase() === v.toLowerCase())
    if (v && !seen && entry.values.length < OPTION_FACETS_MAX) entry.values.push(v)
  }
  return [...byName.values()].slice(0, OPTION_FACETS_MAX)
}

export type ProductPatch = {
  title?: string | undefined
  handle?: string | undefined
  vendor?: string | null | undefined
  productType?: string | null | undefined
  status?: ProductStatus | undefined
}

/** A quick edit from the list. A new handle leaves a redirect behind (`onHandleChange`). */
export async function updateProduct(tx: StoreTx, storeId: string, id: string, patch: ProductPatch) {
  const set = Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined))
  const [before] = await tx
    .select({ handle: product.handle })
    .from(product)
    .where(eq(product.id, id))
  const [row] = await tx
    .update(product)
    .set({ ...set, updatedAt: new Date() })
    .where(eq(product.id, id))
    .returning()
  if (row) await onHandleChange(tx, storeId, 'product', before?.handle, row.handle)
  if (row) await noteProductsChanged(tx, [row.id], storeId)
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
    /* "Stock" is what sells online, summed over the locations that ship online orders. The
       change lands on the primary selling row, so the total becomes what was typed. */
    const [current] = await tx
      .select({ onHand: sellableStock.onHand })
      .from(sellableStock)
      .where(eq(sellableStock.variantId, id))
    const delta = onHand - (current?.onHand ?? 0)
    if (delta !== 0) {
      await tx
        .update(inventoryLevel)
        .set({ onHand: sql`greatest(0, ${inventoryLevel.onHand} + ${delta})` })
        .where(and(eq(inventoryLevel.variantId, id), primarySellingLevel(id)))
    }
  }
  const [row] = await tx.select().from(variant).where(eq(variant.id, id))
  // Price and SKU are in the search index; stock is read live, so it needs no catch-up.
  if (row && Object.keys(variantPatch).length > 0) await noteProductsChanged(tx, [row.productId])
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

/**
 * Variant picker for the draft order editor: one row per sellable variant. `limit` caps the
 * number of matching *products*; every live variant of each one comes back, so a product with
 * many options is never cut off part way through its variants.
 */
export async function searchVariants(
  tx: StoreTx,
  input: { search?: string | undefined; limit?: number | undefined },
): Promise<VariantSearchRow[]> {
  const search = input.search?.trim()
  const live = and(isNull(variant.archivedAt), ne(product.status, 'archived'), notSystemTest)
  const matches = await tx
    .selectDistinct({ id: product.id, title: product.title })
    .from(variant)
    .innerJoin(product, eq(product.id, variant.productId))
    .where(
      and(
        live,
        search
          ? or(
              ilike(product.title, `%${search}%`),
              ilike(variant.sku, `%${search}%`),
              ilike(variant.title, `%${search}%`),
            )
          : undefined,
      ),
    )
    .orderBy(asc(product.title), asc(product.id))
    .limit(input.limit ?? 20)
  if (matches.length === 0) return []
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
        live,
        inArray(
          product.id,
          matches.map((m) => m.id),
        ),
      ),
    )
    .orderBy(asc(product.title), asc(product.id), asc(variant.position))
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
  /** The variant's cost (weighted average landed cost); a purchase order in rupees starts from it. */
  costPaise: number | null
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
      costPaise: variant.costPaise,
      onHand: sellableStock.onHand,
      reserved: sellableStock.reserved,
    })
    .from(variant)
    .leftJoin(sellableStock, eq(sellableStock.variantId, variant.id))
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
        costPaise: v.costPaise,
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
