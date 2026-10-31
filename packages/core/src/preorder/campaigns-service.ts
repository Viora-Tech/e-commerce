/** SOURCE OF TRUTH: listPreorderCampaigns, getPreorderCampaign, createPreorderCampaign,
 *   updatePreorderCampaign, deletePreorderCampaign, preorderOverview, campaignsByIds,
 *   campaignSelection, cartPrimaryMarketId, availableAtLocations
 * WHAT:  Products › Pre-orders: campaigns (one rule set for many products) and the overview
 *        (last 30 days, every pre-order product with its limit, every campaign with its orders
 *        and revenue). The loaders the cart, checkout and storefront use to read a campaign.
 * WHY:   The rules themselves are pure (`./campaigns`); this is only where they meet the rows.
 * WHERE: `preorders.*` (api), Products › Pre-orders (admin), cart.ts, place-order.ts, storefront.
 */
import {
  inventoryLevel,
  location,
  market,
  order,
  orderLine,
  type PreorderCampaignContent,
  type PreorderCampaignDesign,
  preorderCampaign,
  product,
  type StoreTx,
  sellableStock,
  variant,
} from '@commerce/db'
import {
  and,
  asc,
  desc,
  eq,
  gte,
  inArray,
  isNotNull,
  isNull,
  ne,
  notInArray,
  or,
  sql,
} from 'drizzle-orm'
import { notSystemTest } from '../catalog/system-test'
import type { StoreContext } from '../context'
import { CommerceError } from '../errors'
import {
  type PreorderCampaignCreateInput,
  PreorderCampaignCreateSchema,
  type PreorderCampaignTerms,
  type PreorderCampaignUpdateInput,
  PreorderCampaignUpdateSchema,
} from './campaigns'
import { resolvePreorderSettings } from './settings'

/** Why a campaign change was refused, in words the merchant can act on. */
export class PreorderCampaignError extends CommerceError {
  constructor(code: 'CAMPAIGN_NOT_FOUND', message: string, storeId?: string) {
    super(code, message, { storeId })
  }
}

/** The columns `PreorderCampaignTerms` reads; select it (or join it) under any name. */
const campaignSelection = {
  id: preorderCampaign.id,
  name: preorderCampaign.name,
  status: preorderCampaign.status,
  shipDate: preorderCampaign.shipDate,
  shipsInDays: preorderCampaign.shipsInDays,
  limit: preorderCampaign.limit,
  paymentMode: preorderCampaign.paymentMode,
  depositPaise: preorderCampaign.depositPaise,
  depositPercent: preorderCampaign.depositPercent,
  discountType: preorderCampaign.discountType,
  discountValue: preorderCampaign.discountValue,
  marketIds: preorderCampaign.marketIds,
  locationIds: preorderCampaign.locationIds,
  channels: preorderCampaign.channels,
  mixedCart: preorderCampaign.mixedCart,
  soldOutInCart: preorderCampaign.soldOutInCart,
  content: preorderCampaign.content,
  design: preorderCampaign.design,
}

/** Campaigns by id, for rows that carry `preorder_campaign_id`. */
export async function campaignsByIds(
  tx: StoreTx,
  ids: readonly (string | null | undefined)[],
): Promise<Map<string, PreorderCampaignTerms>> {
  const wanted = [...new Set(ids.filter((id): id is string => Boolean(id)))]
  if (wanted.length === 0) return new Map()
  const rows = await tx
    .select(campaignSelection)
    .from(preorderCampaign)
    .where(inArray(preorderCampaign.id, wanted))
  return new Map(rows.map((r) => [r.id, r]))
}

/** The store's primary market: a cart without a market buys in it. Null before Markets is set up. */
export async function cartPrimaryMarketId(tx: StoreTx): Promise<string | null> {
  const [m] = await tx.select({ id: market.id }).from(market).where(eq(market.isPrimary, true))
  return m?.id ?? null
}

/**
 * Stock free to sell (on hand less reserved) at the given locations, per variant: what decides
 * "sold out" for a campaign limited to some locations. Only selling locations count.
 */
export async function availableAtLocations(
  tx: StoreTx,
  variantIds: readonly string[],
  locationIds: readonly string[],
): Promise<Map<string, number>> {
  if (variantIds.length === 0 || locationIds.length === 0) return new Map()
  const rows = await tx
    .select({
      variantId: inventoryLevel.variantId,
      available: sql<number>`coalesce(sum(${inventoryLevel.onHand} - ${inventoryLevel.reserved}), 0)::int`,
    })
    .from(inventoryLevel)
    .where(
      and(
        inArray(inventoryLevel.variantId, [...variantIds]),
        inArray(inventoryLevel.locationId, [...locationIds]),
        eq(inventoryLevel.fulfilsOnline, true),
      ),
    )
    .groupBy(inventoryLevel.variantId)
  return new Map(rows.map((r) => [r.variantId, Math.max(0, r.available)]))
}

/** A campaign in the list: what it sells and what it sold. */
export type PreorderCampaignSummary = PreorderCampaignTerms & {
  productCount: number
  /** Orders (not test, not cancelled) with a line sold under it, ever. */
  orderCount: number
  /** Those lines' value, in paise. */
  revenuePaise: number
  updatedAt: Date
}

export type PreorderCampaignView = PreorderCampaignSummary & { productIds: string[] }

/** Lines that count as sales: real orders that were not cancelled. */
const countedOrder = and(
  eq(order.isTest, false),
  ne(order.status, 'cancelled'),
  ne(order.status, 'draft'),
)

async function campaignSummaries(tx: StoreTx, id?: string): Promise<PreorderCampaignSummary[]> {
  const rows = await tx
    .select({ ...campaignSelection, updatedAt: preorderCampaign.updatedAt })
    .from(preorderCampaign)
    .where(id ? eq(preorderCampaign.id, id) : undefined)
    .orderBy(desc(preorderCampaign.createdAt))
  if (rows.length === 0) return []
  const ids = rows.map((r) => r.id)
  const [products, sales] = await Promise.all([
    tx
      .select({ id: product.preorderCampaignId, n: sql<number>`count(*)::int` })
      .from(product)
      .where(inArray(product.preorderCampaignId, ids))
      .groupBy(product.preorderCampaignId),
    tx
      .select({
        id: orderLine.preorderCampaignId,
        orders: sql<number>`count(distinct ${orderLine.orderId})::int`,
        revenue: sql<number>`coalesce(sum(${orderLine.quantity} * ${orderLine.unitPricePaise}), 0)::bigint`,
      })
      .from(orderLine)
      .innerJoin(order, eq(order.id, orderLine.orderId))
      .where(and(inArray(orderLine.preorderCampaignId, ids), countedOrder))
      .groupBy(orderLine.preorderCampaignId),
  ])
  const productCount = new Map(products.map((p) => [p.id, p.n]))
  const sold = new Map(sales.map((s) => [s.id, s]))
  return rows.map((r) => ({
    ...r,
    productCount: productCount.get(r.id) ?? 0,
    orderCount: sold.get(r.id)?.orders ?? 0,
    revenuePaise: Number(sold.get(r.id)?.revenue ?? 0),
  }))
}

export function listPreorderCampaigns(ctx: StoreContext): Promise<PreorderCampaignSummary[]> {
  return campaignSummaries(ctx.tx)
}

export async function getPreorderCampaign(
  ctx: StoreContext,
  id: string,
): Promise<PreorderCampaignView> {
  const [summary] = await campaignSummaries(ctx.tx, id)
  if (!summary)
    throw new PreorderCampaignError('CAMPAIGN_NOT_FOUND', 'Campaign not found', ctx.storeId)
  const members = await ctx.tx
    .select({ id: product.id })
    .from(product)
    .where(eq(product.preorderCampaignId, id))
    .orderBy(asc(product.title))
  return { ...summary, productIds: members.map((m) => m.id) }
}

/** The chosen products join the campaign (leaving any other); the rest of its products leave it. */
async function setMembers(tx: StoreTx, campaignId: string, productIds: string[]) {
  const now = new Date()
  await tx
    .update(product)
    .set({ preorderCampaignId: null, updatedAt: now })
    .where(
      and(
        eq(product.preorderCampaignId, campaignId),
        productIds.length > 0 ? notInArray(product.id, productIds) : undefined,
      ),
    )
  if (productIds.length === 0) return
  await tx
    .update(product)
    .set({ preorderCampaignId: campaignId, updatedAt: now })
    .where(inArray(product.id, productIds))
}

export async function createPreorderCampaign(
  ctx: StoreContext,
  input: PreorderCampaignCreateInput,
): Promise<PreorderCampaignView> {
  const { productIds, ...fields } = PreorderCampaignCreateSchema.parse(input)
  const [row] = await ctx.tx
    .insert(preorderCampaign)
    .values({ ...fields, storeId: ctx.storeId })
    .returning({ id: preorderCampaign.id })
  if (!row) throw new Error('preorder campaign insert returned nothing')
  await setMembers(ctx.tx, row.id, productIds)
  return getPreorderCampaign(ctx, row.id)
}

/** The value sent, or the one the campaign has when nothing was sent for it. */
const keep = <T>(next: T | undefined, now: T): T => (next === undefined ? now : next)

export async function updatePreorderCampaign(
  ctx: StoreContext,
  input: PreorderCampaignUpdateInput,
): Promise<PreorderCampaignView> {
  const { id, productIds, ...f } = PreorderCampaignUpdateSchema.parse(input)
  const [now] = await ctx.tx
    .select(campaignSelection)
    .from(preorderCampaign)
    .where(eq(preorderCampaign.id, id))
  if (!now) throw new PreorderCampaignError('CAMPAIGN_NOT_FOUND', 'Campaign not found', ctx.storeId)
  await ctx.tx
    .update(preorderCampaign)
    .set({
      name: keep(f.name, now.name),
      status: keep(f.status, now.status),
      shipDate: keep(f.shipDate, now.shipDate),
      shipsInDays: keep(f.shipsInDays, now.shipsInDays),
      limit: keep(f.limit, now.limit),
      paymentMode: keep(f.paymentMode, now.paymentMode),
      depositPaise: keep(f.depositPaise, now.depositPaise),
      depositPercent: keep(f.depositPercent, now.depositPercent),
      discountType: keep(f.discountType, now.discountType),
      discountValue: keep(f.discountValue, now.discountValue),
      marketIds: keep(f.marketIds, now.marketIds),
      locationIds: keep(f.locationIds, now.locationIds),
      channels: keep(f.channels, now.channels),
      mixedCart: keep(f.mixedCart, now.mixedCart),
      soldOutInCart: keep(f.soldOutInCart, now.soldOutInCart),
      content: keep<PreorderCampaignContent>(f.content, now.content),
      design: keep<PreorderCampaignDesign>(f.design, now.design),
      updatedAt: new Date(),
    })
    .where(eq(preorderCampaign.id, id))
  if (productIds) await setMembers(ctx.tx, id, productIds)
  return getPreorderCampaign(ctx, id)
}

/** Delete a campaign: its products sell by their own pre-order settings again. */
export async function deletePreorderCampaign(ctx: StoreContext, id: string): Promise<void> {
  // Product, cart and order lines let go of it (on delete set null); sales history keeps the lines.
  const rows = await ctx.tx
    .delete(preorderCampaign)
    .where(eq(preorderCampaign.id, id))
    .returning({ id: preorderCampaign.id })
  if (rows.length === 0) {
    throw new PreorderCampaignError('CAMPAIGN_NOT_FOUND', 'Campaign not found', ctx.storeId)
  }
}

/** One pre-order product on the overview. */
export type PreorderProductRow = {
  id: string
  title: string
  campaignId: string | null
  campaignName: string | null
  /** Orders (not test, not cancelled) with a pre-order line of it, ever. */
  orderCount: number
  /** Pre-order units still free under the limit, summed over its variants; null = no limit. */
  left: number | null
  limit: number | null
  status: 'active' | 'full' | 'off'
}

export type PreorderOverview = {
  /** The last 30 days: orders with a pre-order line and those lines' value. */
  last30: { orderCount: number; revenuePaise: number; units: number }
  products: PreorderProductRow[]
  campaigns: PreorderCampaignSummary[]
  /** Store locations and markets, for the campaign form's pickers. */
  markets: { id: string; name: string; isPrimary: boolean }[]
  locations: { id: string; name: string }[]
}

const DAY_MS = 24 * 60 * 60 * 1000
/** Matches no row: `in ()` with nothing to look for. */
const NONE = '00000000-0000-0000-0000-000000000000'

/** Products › Pre-orders: the numbers, the products and the campaigns. */
export async function preorderOverview(
  ctx: StoreContext,
  now = new Date(),
): Promise<PreorderOverview> {
  const tx = ctx.tx
  const since = new Date(now.getTime() - 30 * DAY_MS)
  const [recent, campaigns, products, markets, locations] = await Promise.all([
    tx
      .select({
        orders: sql<number>`count(distinct ${orderLine.orderId})::int`,
        revenue: sql<number>`coalesce(sum(${orderLine.quantity} * ${orderLine.unitPricePaise}), 0)::bigint`,
        units: sql<number>`coalesce(sum(${orderLine.quantity}), 0)::int`,
      })
      .from(orderLine)
      .innerJoin(order, eq(order.id, orderLine.orderId))
      .where(and(eq(orderLine.preorder, true), countedOrder, gte(order.placedAt, since))),
    campaignSummaries(tx),
    tx
      .select({
        id: product.id,
        title: product.title,
        campaignId: product.preorderCampaignId,
        preorderEnabled: product.preorderEnabled,
        preorderShipDate: product.preorderShipDate,
        preorderShipsInDays: product.preorderShipsInDays,
        preorderLimit: product.preorderLimit,
        preorderButtonLabel: product.preorderButtonLabel,
        preorderPaymentMode: product.preorderPaymentMode,
        preorderDepositPaise: product.preorderDepositPaise,
        preorderDepositPercent: product.preorderDepositPercent,
        preorderOwn: product.preorderOwn,
      })
      .from(product)
      .where(
        and(
          notSystemTest,
          ne(product.status, 'archived'),
          or(eq(product.preorderEnabled, true), isNotNull(product.preorderCampaignId)),
        ),
      )
      .orderBy(asc(product.title))
      .limit(500),
    tx
      .select({ id: market.id, name: market.name, isPrimary: market.isPrimary })
      .from(market)
      .orderBy(desc(market.isPrimary), asc(market.name)),
    tx
      .select({ id: location.id, name: location.name })
      .from(location)
      .where(eq(location.active, true))
      .orderBy(asc(location.name)),
  ])
  const ids = products.map((p) => p.id)
  const [variants, sales] = await Promise.all([
    tx
      .select({
        productId: variant.productId,
        override: variant.preorderOverride,
        tracked: variant.trackInventory,
        onHand: sellableStock.onHand,
        reserved: sellableStock.reserved,
      })
      .from(variant)
      .leftJoin(sellableStock, eq(sellableStock.variantId, variant.id))
      .where(
        and(inArray(variant.productId, ids.length ? ids : [NONE]), isNull(variant.archivedAt)),
      ),
    tx
      .select({
        productId: variant.productId,
        orders: sql<number>`count(distinct ${orderLine.orderId})::int`,
      })
      .from(orderLine)
      .innerJoin(order, eq(order.id, orderLine.orderId))
      .innerJoin(variant, eq(variant.id, orderLine.variantId))
      .where(
        and(
          eq(orderLine.preorder, true),
          countedOrder,
          inArray(variant.productId, ids.length ? ids : [NONE]),
        ),
      )
      .groupBy(variant.productId),
  ])
  const byId = new Map(campaigns.map((c) => [c.id, c]))
  const ordersOf = new Map(sales.map((s) => [s.productId, s.orders]))
  const rows: PreorderProductRow[] = products.map((p) => {
    const campaign = p.campaignId ? (byId.get(p.campaignId) ?? null) : null
    const live = campaign?.status === 'active' ? campaign : null
    let limit: number | null = 0
    let left: number | null = 0
    let enabled = false
    for (const v of variants.filter((x) => x.productId === p.id)) {
      const s = resolvePreorderSettings(p, v.override, live)
      if (!s.enabled) continue
      enabled = true
      if (s.limit == null || !v.tracked || limit === null || left === null) {
        limit = null
        left = null
        continue
      }
      const committed = Math.max(0, (v.reserved ?? 0) - (v.onHand ?? 0))
      limit += s.limit
      left += Math.max(0, s.limit - committed)
    }
    return {
      id: p.id,
      title: p.title,
      campaignId: p.campaignId,
      campaignName: campaign?.name ?? null,
      orderCount: ordersOf.get(p.id) ?? 0,
      limit: enabled ? limit : null,
      left: enabled ? left : null,
      status: !enabled ? 'off' : left === 0 && limit !== null && limit > 0 ? 'full' : 'active',
    }
  })
  const r = recent[0]
  return {
    last30: {
      orderCount: r?.orders ?? 0,
      revenuePaise: Number(r?.revenue ?? 0),
      units: r?.units ?? 0,
    },
    products: rows,
    campaigns,
    markets,
    locations,
  }
}
