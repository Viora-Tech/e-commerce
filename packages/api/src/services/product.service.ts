import {
  DEFAULT_GST_RATE_PERCENT,
  LOW_STOCK_THRESHOLD,
  listedPriceRange,
  loadVariantMedia,
  noteProductEvent,
  noteProductsChanged,
  notSystemTest,
  onHandleChange,
  type ProductMissingFilter,
  parseStoreTax,
  type StockFilter,
  storeLowStockThreshold,
  watchStockCrossings,
} from '@commerce/core'
import type { StoreTx } from '@commerce/db'
import {
  collection,
  inventoryLevel,
  media,
  primarySellingLevel,
  product,
  productMedia,
  productOption,
  productOptionValue,
  sellableStock,
  sellableStockForProducts,
  store,
  variant,
  variantOptionValue,
} from '@commerce/db'
import { and, asc, count, desc, eq, gte, ilike, inArray, isNull, lt, or, sql } from 'drizzle-orm'

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
  missing?: ProductMissingFilter | undefined
  ids?: string[] | undefined
  vendors?: string[] | undefined
  productTypes?: string[] | undefined
  tags?: string[] | undefined
  collectionIds?: string[] | undefined
  priceMinPaise?: number | undefined
  priceMaxPaise?: number | undefined
  createdFrom?: string | undefined
  createdTo?: string | undefined
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
          sql`exists (
            select 1 from variant v
            where v.product_id = ${product.id} and v.archived_at is null
              and v.sku ilike ${`%${input.search}%`}
          )`,
        )
      : undefined,
    input.ids ? inArray(product.id, input.ids) : undefined,
    input.status ? eq(product.status, input.status) : undefined,
    input.vendor ? eq(product.vendor, input.vendor) : undefined,
    input.productType ? eq(product.productType, input.productType) : undefined,
    input.tag ? sql`${input.tag} = ANY(${product.tags})` : undefined,
    input.vendors?.length ? inArray(product.vendor, input.vendors) : undefined,
    input.productTypes?.length ? inArray(product.productType, input.productTypes) : undefined,
    input.tags?.length ? sql`${product.tags} && ${sql.param(input.tags)}::text[]` : undefined,
    input.collectionIds?.length
      ? sql`exists (
          select 1 from collection_product cp
          where cp.product_id = ${product.id}
            and cp.collection_id = any(${sql.param(input.collectionIds)}::uuid[])
        )`
      : undefined,
    input.priceMinPaise !== undefined || input.priceMaxPaise !== undefined
      ? sql`exists (
          select 1 from variant v
          where v.product_id = ${product.id} and v.archived_at is null
            and v.price_paise >= ${input.priceMinPaise ?? 0}
            and v.price_paise <= ${input.priceMaxPaise ?? 2_147_483_647}
        )`
      : undefined,
    input.createdFrom ? gte(product.createdAt, new Date(input.createdFrom)) : undefined,
    input.createdTo ? lt(product.createdAt, new Date(input.createdTo)) : undefined,
    input.missing === 'weight'
      ? sql`${product.isGiftCard} = false and exists (
          select 1 from variant v
          where v.product_id = ${product.id} and v.archived_at is null
            and coalesce(v.weight_grams, 0) = 0
        )`
      : undefined,
    // No box chosen (Settings › Shipping boxes): booking falls back to the default box.
    input.missing === 'box'
      ? sql`${product.isGiftCard} = false and exists (
          select 1 from variant v
          where v.product_id = ${product.id} and v.archived_at is null
            and v.box_preset_id is null
        )`
      : undefined,
    input.missing === 'image'
      ? sql`not exists (select 1 from product_media pm where pm.product_id = ${product.id})`
      : undefined,
    // A variant shoppers can see at ₹0 (#934): Store health's "priced at ₹0" check.
    input.missing === 'price'
      ? sql`${product.isGiftCard} = false and exists (
          select 1 from variant v
          where v.product_id = ${product.id} and v.archived_at is null
            and v.hidden_on_store = false and v.price_paise = 0
        )`
      : undefined,
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
  // Only the columns a row shows: not the description, SEO text and the rest of each product.
  const rows = await tx
    .select({
      id: product.id,
      handle: product.handle,
      title: product.title,
      status: product.status,
      vendor: product.vendor,
      productType: product.productType,
      tags: product.tags,
      preorderEnabled: product.preorderEnabled,
      launchAt: product.launchAt,
    })
    .from(product)
    .where(where)
    .orderBy(desc(product.createdAt))
    .limit(input.perPage)
    .offset((input.page - 1) * input.perPage)
  if (rows.length === 0) return { items: [], total }
  const ids = rows.map((r) => r.id)

  // Selling stock for this page's variants only, not every stock row in the store.
  const stock = sellableStockForProducts(ids)
  const variants = await tx
    .select({
      productId: variant.productId,
      pricePaise: variant.pricePaise,
      hiddenOnStore: variant.hiddenOnStore,
      onHand: stock.onHand,
      reserved: stock.reserved,
    })
    .from(variant)
    .leftJoin(stock, eq(stock.variantId, variant.id))
    .where(and(inArray(variant.productId, ids), isNull(variant.archivedAt)))
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
        minPricePaise: listedPriceRange(vs)?.min ?? null,
        maxPricePaise: listedPriceRange(vs)?.max ?? null,
        // Not clamped: below zero is oversold (pre-orders owed), which the merchant must see (#53).
        available: vs.reduce((n, v) => n + (v.onHand ?? 0) - (v.reserved ?? 0), 0),
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
      hiddenOnStore: variant.hiddenOnStore,
      preorderOverride: variant.preorderOverride,
      requiresShipping: variant.requiresShipping,
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
  const variantImages = await loadVariantMedia(
    tx,
    variants.map((v) => v.id),
  )
  return {
    ...p,
    images,
    options: options.map((o) => ({
      id: o.id,
      name: o.name,
      values: values.filter((v) => v.optionId === o.id).map((v) => ({ id: v.id, value: v.value })),
    })),
    variants: variants.map(({ preorderOverride, ...v }) => ({
      ...v,
      /** The variant's "Allow pre-order" switch (on unless its override turns it off). */
      preorderAllowed: preorderOverride?.enabled !== false,
      /** The variant's images in order; the first is `mediaId`. */
      mediaIds: variantImages.get(v.id) ?? (v.mediaId ? [v.mediaId] : []),
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
  // Distinct values come back from Postgres, not one row per product (and per tag).
  const [vendorRows, typeRows, tagRows, optionRows, collections, [storeRow]] = await Promise.all([
    tx.selectDistinct({ v: product.vendor }).from(product).where(notSystemTest),
    tx.selectDistinct({ v: product.productType }).from(product).where(notSystemTest),
    tx
      .selectDistinct({ v: sql<string | null>`unnest(${product.tags})` })
      .from(product)
      .where(notSystemTest),
    tx
      .select({ name: productOption.name, value: productOptionValue.value })
      .from(productOptionValue)
      .innerJoin(productOption, eq(productOption.id, productOptionValue.optionId))
      .orderBy(asc(productOption.name), asc(productOptionValue.position)),
    tx
      .select({ id: collection.id, title: collection.title })
      .from(collection)
      .orderBy(asc(collection.title)),
    tx
      .select({
        gstRatePercent: store.gstRatePercent,
        apps: store.apps,
        lowStockThreshold: store.lowStockThreshold,
      })
      .from(store)
      .where(eq(store.id, storeId)),
  ])
  const uniq = (xs: (string | null)[]) =>
    [...new Set(xs.filter((x): x is string => Boolean(x)))].sort((a, b) => a.localeCompare(b))
  return {
    vendors: uniq(vendorRows.map((r) => r.v)),
    productTypes: uniq(typeRows.map((r) => r.v)),
    tags: uniq(tagRows.map((r) => r.v)),
    options: optionFacets(optionRows),
    /** For the list's Collection filter. */
    collections,
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
  if (row) await noteProductEvent(tx, storeId, 'product.updated', [row.id])
  return row ?? null
}

export type VariantPatch = {
  pricePaise?: number | undefined
  mrpPaise?: number | null | undefined
  sku?: string | null | undefined
  onHand?: number | undefined
  hiddenOnStore?: boolean | undefined
  requiresShipping?: boolean | undefined
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
      const [owner] = await tx
        .select({ storeId: variant.storeId })
        .from(variant)
        .where(eq(variant.id, id))
      // Falling to low or out of stock is an Automations trigger (once per crossing).
      await watchStockCrossings(tx, owner?.storeId ?? '', [id], () =>
        tx
          .update(inventoryLevel)
          .set({ onHand: sql`greatest(0, ${inventoryLevel.onHand} + ${delta})` })
          .where(and(eq(inventoryLevel.variantId, id), primarySellingLevel(id))),
      )
    }
  }
  const [row] = await tx.select().from(variant).where(eq(variant.id, id))
  // Price and SKU are in the search index; stock is read live, so it needs no catch-up.
  if (row && Object.keys(variantPatch).length > 0) {
    await noteProductsChanged(tx, [row.productId])
    await noteProductEvent(tx, row.storeId, 'product.updated', [row.productId])
  }
  return row ?? null
}

/** Handles already in the store, so the import preview can say create or update. */
export async function listProductHandles(tx: StoreTx): Promise<string[]> {
  const rows = await tx.select({ handle: product.handle }).from(product)
  return rows.map((r) => r.handle)
}
