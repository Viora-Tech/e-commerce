/** SOURCE OF TRUTH: listCatalogs, getCatalog, createCatalog, updateCatalog, deleteCatalog,
 *   storeMarketCatalogs, unsoldInMarket, CatalogError
 * WHAT:  Markets › Catalogs, Shopify style: a named set of products (all, or chosen products and
 *        collections) with optional price changes (a percent, fixed prices per variant), used by
 *        the markets it is given to (one catalog per market). A draft catalog is kept but not
 *        applied. `storeMarketCatalogs` is what the storefront reads; `unsoldInMarket` is the
 *        cart and checkout's check.
 * WHY:   A market abroad may sell part of the range at its own prices. India (no catalog) sells
 *        everything at the product's own price, exactly as before.
 * WHERE: `catalogs.*` (api), Markets › Catalogs (admin), `storeMarketPricing`, addToCart, placeOrder.
 */
import {
  CATALOG_SCOPES,
  CATALOG_STATUSES,
  type CatalogScope,
  type CatalogStatus,
  catalog,
  catalogCollection,
  catalogPrice,
  catalogProduct,
  collection,
  collectionProduct,
  type Db,
  market,
  product,
  type StoreTx,
  variant,
} from '@commerce/db'
import { and, asc, count, eq, inArray, isNull, notInArray, type SQL, sql } from 'drizzle-orm'
import { z } from 'zod'
import type { StoreContext } from '../context'
import { CommerceError } from '../errors'
import type { CatalogPricing } from './catalog-rules'

/** Why a catalog change was refused, in words the merchant can act on. */
export class CatalogError extends CommerceError {
  constructor(code: 'CATALOG_NOT_FOUND' | 'CATALOG_INVALID', message: string, storeId?: string) {
    super(code, message, { storeId })
  }
}

/** The most products, collections and fixed prices one catalog names. */
const MAX_ITEMS = 5000

const PriceSchema = z.object({
  variantId: z.uuid(),
  currency: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{3}$/),
  amountMinor: z.number().int().positive().max(1_000_000_000_000),
})

const fields = {
  name: z.string().trim().min(1, 'Give the catalog a name').max(80),
  status: z.enum(CATALOG_STATUSES),
  scope: z.enum(CATALOG_SCOPES),
  /** -9000 to +20000 basis points: 90% off to 200% more. */
  priceAdjustmentBp: z.number().int().min(-9000).max(20000),
  productIds: z.array(z.uuid()).max(MAX_ITEMS),
  collectionIds: z.array(z.uuid()).max(MAX_ITEMS),
  prices: z.array(PriceSchema).max(MAX_ITEMS),
  /** The markets that sell from it; each leaves the catalog it had. */
  marketIds: z.array(z.uuid()).max(200),
}

export const CatalogCreateSchema = z.object({
  name: fields.name,
  status: fields.status.default('active'),
  scope: fields.scope.default('all'),
  priceAdjustmentBp: fields.priceAdjustmentBp.default(0),
  productIds: fields.productIds.default([]),
  collectionIds: fields.collectionIds.default([]),
  prices: fields.prices.default([]),
  marketIds: fields.marketIds.default([]),
})
export type CatalogCreateInput = z.input<typeof CatalogCreateSchema>

/** Only the fields sent change. */
export const CatalogUpdateSchema = z.object({
  id: z.uuid(),
  name: fields.name.optional(),
  status: fields.status.optional(),
  scope: fields.scope.optional(),
  priceAdjustmentBp: fields.priceAdjustmentBp.optional(),
  productIds: fields.productIds.optional(),
  collectionIds: fields.collectionIds.optional(),
  prices: fields.prices.optional(),
  marketIds: fields.marketIds.optional(),
})
export type CatalogUpdateInput = z.input<typeof CatalogUpdateSchema>

export const CatalogIdSchema = z.object({ id: z.uuid() })

/** A market as a catalog shows it. */
export type CatalogMarket = { id: string; name: string; currency: string; isPrimary: boolean }

/** A catalog in the list: what it sells, its price change and who uses it. */
export type CatalogSummary = {
  id: string
  name: string
  status: CatalogStatus
  scope: CatalogScope
  priceAdjustmentBp: number
  /** Products it sells today: every active product for `all`. */
  productCount: number
  fixedPriceCount: number
  markets: CatalogMarket[]
}

/** One fixed price with what the admin shows for its variant. */
export type CatalogPriceView = {
  variantId: string
  productId: string
  title: string
  variantTitle: string
  currency: string
  amountMinor: number
  /** The variant's own price, for comparison. */
  pricePaise: number | null
}

export type CatalogView = CatalogSummary & {
  productIds: string[]
  collectionIds: string[]
  prices: CatalogPriceView[]
}

/** Products a catalog sells: by name, or through one of its collections. */
export function chosenProducts(catalogId: string | SQL) {
  return sql`(
    select cp.product_id from ${catalogProduct} cp where cp.catalog_id = ${catalogId}
    union
    select col.product_id from ${catalogCollection} cc
      join ${collectionProduct} col on col.collection_id = cc.collection_id
     where cc.catalog_id = ${catalogId})`
}

async function summaries(tx: StoreTx, id?: string): Promise<CatalogSummary[]> {
  const rows = await tx
    .select()
    .from(catalog)
    .where(id ? eq(catalog.id, id) : undefined)
    .orderBy(asc(catalog.name), asc(catalog.id))
  if (rows.length === 0) return []
  const ids = rows.map((r) => r.id)
  const live = and(eq(product.status, 'active'), eq(product.isSystemTest, false))
  const [all] = await tx.select({ n: count() }).from(product).where(live)
  const chosen = await Promise.all(
    rows
      .filter((r) => r.scope === 'chosen')
      .map(async (r) => {
        const [c] = await tx
          .select({ n: count() })
          .from(product)
          .where(and(live, sql`${product.id} in ${chosenProducts(r.id)}`))
        return [r.id, Number(c?.n ?? 0)] as const
      }),
  )
  const counts = new Map(chosen)
  const prices = await tx
    .select({ catalogId: catalogPrice.catalogId, n: count() })
    .from(catalogPrice)
    .where(inArray(catalogPrice.catalogId, ids))
    .groupBy(catalogPrice.catalogId)
  const markets = await tx
    .select({
      id: market.id,
      name: market.name,
      currency: market.currency,
      isPrimary: market.isPrimary,
      catalogId: market.catalogId,
    })
    .from(market)
    .where(inArray(market.catalogId, ids))
    .orderBy(asc(market.name))
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    status: r.status,
    scope: r.scope,
    priceAdjustmentBp: r.priceAdjustmentBp,
    productCount: r.scope === 'all' ? Number(all?.n ?? 0) : (counts.get(r.id) ?? 0),
    fixedPriceCount: Number(prices.find((p) => p.catalogId === r.id)?.n ?? 0),
    markets: markets.filter((m) => m.catalogId === r.id).map(({ catalogId: _c, ...m }) => m),
  }))
}

/** Every catalog, A–Z, with its product count and markets. */
export async function listCatalogs(ctx: StoreContext): Promise<CatalogSummary[]> {
  return summaries(ctx.tx)
}

/** One catalog with its chosen products and collections and its fixed prices. */
export async function getCatalog(ctx: StoreContext, id: string): Promise<CatalogView> {
  const [summary] = await summaries(ctx.tx, id)
  if (!summary) throw new CatalogError('CATALOG_NOT_FOUND', 'Catalog not found', ctx.storeId)
  const products = await ctx.tx
    .select({ id: catalogProduct.productId })
    .from(catalogProduct)
    .where(eq(catalogProduct.catalogId, id))
    .orderBy(asc(catalogProduct.createdAt), asc(catalogProduct.id))
  const collections = await ctx.tx
    .select({ id: catalogCollection.collectionId })
    .from(catalogCollection)
    .where(eq(catalogCollection.catalogId, id))
    .orderBy(asc(catalogCollection.createdAt), asc(catalogCollection.id))
  const prices = await ctx.tx
    .select({
      variantId: catalogPrice.variantId,
      productId: product.id,
      title: product.title,
      variantTitle: variant.title,
      currency: catalogPrice.currency,
      amountMinor: catalogPrice.amountMinor,
      pricePaise: variant.pricePaise,
    })
    .from(catalogPrice)
    .innerJoin(variant, eq(variant.id, catalogPrice.variantId))
    .innerJoin(product, eq(product.id, variant.productId))
    .where(eq(catalogPrice.catalogId, id))
    .orderBy(asc(product.title), asc(variant.position))
  return {
    ...summary,
    productIds: products.map((p) => p.id),
    collectionIds: collections.map((c) => c.id),
    prices,
  }
}

type Draft = {
  name: string
  status: CatalogStatus
  scope: CatalogScope
  priceAdjustmentBp: number
  productIds: string[]
  collectionIds: string[]
  prices: z.infer<typeof PriceSchema>[]
  marketIds: string[]
}

const invalid = (ctx: StoreContext, message: string) =>
  new CatalogError('CATALOG_INVALID', message, ctx.storeId)

/** Ids once each; every one must be the store's own (RLS hides any other store's). */
async function checkDraft(ctx: StoreContext, d: Draft): Promise<Draft> {
  const productIds = [...new Set(d.productIds)]
  const collectionIds = [...new Set(d.collectionIds)]
  const marketIds = [...new Set(d.marketIds)]
  const prices = [...new Map(d.prices.map((p) => [p.variantId, p])).values()]
  const known = async (ids: string[], table: typeof product | typeof collection) =>
    ids.length === 0
      ? 0
      : Number(
          (await ctx.tx.select({ n: count() }).from(table).where(inArray(table.id, ids)))[0]?.n ??
            0,
        )
  if ((await known(productIds, product)) !== productIds.length) {
    throw invalid(ctx, 'One of the chosen products no longer exists')
  }
  if ((await known(collectionIds, collection)) !== collectionIds.length) {
    throw invalid(ctx, 'One of the chosen collections no longer exists')
  }
  if (prices.length > 0) {
    const [v] = await ctx.tx
      .select({ n: count() })
      .from(variant)
      .where(
        and(
          inArray(
            variant.id,
            prices.map((p) => p.variantId),
          ),
          isNull(variant.archivedAt),
        ),
      )
    if (Number(v?.n ?? 0) !== prices.length) {
      throw invalid(ctx, 'One of the variants with a fixed price no longer exists')
    }
  }
  const markets =
    marketIds.length === 0
      ? []
      : await ctx.tx
          .select({ id: market.id, name: market.name, currency: market.currency })
          .from(market)
          .where(inArray(market.id, marketIds))
  if (markets.length !== marketIds.length) throw invalid(ctx, 'One of the markets no longer exists')
  // A rupee market charges the product's own price at checkout: a catalog there only chooses
  // products, so its prices could never match what the shopper pays.
  const rupee = markets.find((m) => m.currency === 'INR')
  if (rupee && (d.priceAdjustmentBp !== 0 || prices.some((p) => p.currency === 'INR'))) {
    throw invalid(
      ctx,
      `${rupee.name} sells in rupees, where checkout charges each product's own price. Change the price on the product, or leave this catalog's prices as they are.`,
    )
  }
  return { ...d, productIds, collectionIds, marketIds, prices }
}

async function writeParts(ctx: StoreContext, id: string, d: Draft, parts: Set<keyof Draft>) {
  const { tx, storeId } = ctx
  if (parts.has('productIds')) {
    await tx.delete(catalogProduct).where(eq(catalogProduct.catalogId, id))
    if (d.productIds.length > 0) {
      await tx
        .insert(catalogProduct)
        .values(d.productIds.map((productId) => ({ storeId, catalogId: id, productId })))
    }
  }
  if (parts.has('collectionIds')) {
    await tx.delete(catalogCollection).where(eq(catalogCollection.catalogId, id))
    if (d.collectionIds.length > 0) {
      await tx
        .insert(catalogCollection)
        .values(d.collectionIds.map((collectionId) => ({ storeId, catalogId: id, collectionId })))
    }
  }
  if (parts.has('prices')) {
    await tx.delete(catalogPrice).where(eq(catalogPrice.catalogId, id))
    if (d.prices.length > 0) {
      await tx.insert(catalogPrice).values(d.prices.map((p) => ({ storeId, catalogId: id, ...p })))
    }
  }
  if (parts.has('marketIds')) {
    // Markets no longer picked sell without a catalog; picked ones leave the catalog they had.
    await tx
      .update(market)
      .set({ catalogId: null })
      .where(
        and(
          eq(market.catalogId, id),
          d.marketIds.length > 0 ? notInArray(market.id, d.marketIds) : undefined,
        ),
      )
    if (d.marketIds.length > 0) {
      await tx.update(market).set({ catalogId: id }).where(inArray(market.id, d.marketIds))
    }
  }
}

/** Add a catalog; the markets named start selling from it. */
export async function createCatalog(
  ctx: StoreContext,
  input: CatalogCreateInput,
): Promise<CatalogView> {
  const d = await checkDraft(ctx, CatalogCreateSchema.parse(input))
  const [row] = await ctx.tx
    .insert(catalog)
    .values({
      storeId: ctx.storeId,
      name: d.name,
      status: d.status,
      scope: d.scope,
      priceAdjustmentBp: d.priceAdjustmentBp,
    })
    .returning({ id: catalog.id })
  if (!row) throw new Error('catalog insert returned nothing')
  await writeParts(
    ctx,
    row.id,
    d,
    new Set(['productIds', 'collectionIds', 'prices', 'marketIds'] as const),
  )
  return getCatalog(ctx, row.id)
}

/** Change a catalog; only the parts sent are replaced. */
export async function updateCatalog(
  ctx: StoreContext,
  input: CatalogUpdateInput,
): Promise<CatalogView> {
  const parsed = CatalogUpdateSchema.parse(input)
  const current = await getCatalog(ctx, parsed.id)
  const d = await checkDraft(ctx, {
    name: parsed.name ?? current.name,
    status: parsed.status ?? current.status,
    scope: parsed.scope ?? current.scope,
    priceAdjustmentBp: parsed.priceAdjustmentBp ?? current.priceAdjustmentBp,
    productIds: parsed.productIds ?? current.productIds,
    collectionIds: parsed.collectionIds ?? current.collectionIds,
    prices:
      parsed.prices ??
      current.prices.map((p) => ({
        variantId: p.variantId,
        currency: p.currency,
        amountMinor: p.amountMinor,
      })),
    marketIds: parsed.marketIds ?? current.markets.map((m) => m.id),
  })
  await ctx.tx
    .update(catalog)
    .set({
      name: d.name,
      status: d.status,
      scope: d.scope,
      priceAdjustmentBp: d.priceAdjustmentBp,
    })
    .where(eq(catalog.id, parsed.id))
  const parts = new Set(
    (['productIds', 'collectionIds', 'prices', 'marketIds'] as const).filter(
      (k) => parsed[k] !== undefined,
    ),
  )
  await writeParts(ctx, parsed.id, d, parts)
  return getCatalog(ctx, parsed.id)
}

/** Delete a catalog; its markets sell every product at their own prices again. */
export async function deleteCatalog(ctx: StoreContext, id: string): Promise<void> {
  const gone = await ctx.tx.delete(catalog).where(eq(catalog.id, id)).returning({ id: catalog.id })
  if (gone.length === 0) {
    throw new CatalogError('CATALOG_NOT_FOUND', 'Catalog not found', ctx.storeId)
  }
}

/** What one market's active catalog does on the storefront. */
export type MarketCatalog = {
  catalogId: string
  /** Sells chosen products only: listings hide the rest, the cart and checkout refuse them. */
  chosen: boolean
  pricing: CatalogPricing
}

/**
 * Each market's active catalog by market id (read under the store's RLS); markets without
 * one, or with a draft, are absent. Fixed prices are kept only in the market's own currency.
 */
export async function storeMarketCatalogs(tx: Db | StoreTx): Promise<Map<string, MarketCatalog>> {
  const rows = await tx
    .select({
      marketId: market.id,
      currency: market.currency,
      catalogId: catalog.id,
      scope: catalog.scope,
      adjustmentBp: catalog.priceAdjustmentBp,
    })
    .from(market)
    .innerJoin(catalog, eq(catalog.id, market.catalogId))
    .where(eq(catalog.status, 'active'))
  if (rows.length === 0) return new Map()
  const prices = await tx
    .select({
      catalogId: catalogPrice.catalogId,
      variantId: catalogPrice.variantId,
      currency: catalogPrice.currency,
      amountMinor: catalogPrice.amountMinor,
    })
    .from(catalogPrice)
    .where(
      inArray(
        catalogPrice.catalogId,
        rows.map((r) => r.catalogId),
      ),
    )
  return new Map(
    rows.map((r) => [
      r.marketId,
      {
        catalogId: r.catalogId,
        chosen: r.scope === 'chosen',
        pricing: {
          adjustmentBp: r.adjustmentBp,
          fixedMinor: Object.fromEntries(
            prices
              .filter((p) => p.catalogId === r.catalogId && p.currency === r.currency)
              .map((p) => [p.variantId, p.amountMinor]),
          ),
        },
      },
    ]),
  )
}

/**
 * Of these products, the ones the market's catalog does not sell: none without a market, a
 * catalog, or when its catalog is a draft or sells everything. The cart and checkout refuse them.
 */
export async function unsoldInMarket(
  tx: StoreTx,
  marketId: string | null | undefined,
  productIds: string[],
): Promise<string[]> {
  if (!marketId || productIds.length === 0) return []
  const [m] = await tx
    .select({ catalogId: catalog.id })
    .from(market)
    .innerJoin(catalog, eq(catalog.id, market.catalogId))
    .where(and(eq(market.id, marketId), eq(catalog.status, 'active'), eq(catalog.scope, 'chosen')))
  if (!m) return []
  const wanted = [...new Set(productIds)]
  const sold = await tx
    .select({ id: product.id })
    .from(product)
    .where(and(inArray(product.id, wanted), sql`${product.id} in ${chosenProducts(m.catalogId)}`))
  const ok = new Set(sold.map((r) => r.id))
  return wanted.filter((id) => !ok.has(id))
}
