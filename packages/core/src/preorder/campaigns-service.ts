/** SOURCE OF TRUTH: listPreorderCampaigns, getPreorderCampaign, createPreorderCampaign,
 *   updatePreorderCampaign, deletePreorderCampaign, campaignsByIds,
 *   campaignSelection, cartPrimaryMarketId, availableAtLocations
 * WHAT:  Products › Pre-orders: campaigns (one rule set for many products), each with its orders
 *        and revenue. The loaders the cart, checkout and storefront use to read a campaign.
 *        The page's overview is `./campaigns-overview`.
 * WHY:   The rules themselves are pure (`./campaigns`); this is only where they meet the rows.
 * WHERE: `preorders.*` (api), Products › Pre-orders (admin), cart.ts, place-order.ts, storefront.
 */
import {
  inventoryLevel,
  market,
  order,
  orderLine,
  type PreorderCampaignContent,
  type PreorderCampaignDesign,
  preorderCampaign,
  product,
  type StoreTx,
  variant,
} from '@commerce/db'
import { and, asc, desc, eq, inArray, isNull, notInArray, sql } from 'drizzle-orm'
import type { StoreContext } from '../context'
import { CommerceError } from '../errors'
import { countedOrder } from './campaign-orders'
import {
  type PreorderCampaignCreateInput,
  PreorderCampaignCreateSchema,
  type PreorderCampaignMember,
  type PreorderCampaignTerms,
  type PreorderCampaignUpdateInput,
  PreorderCampaignUpdateSchema,
} from './campaigns'
import { variantAllowsPreorder, withPreorderAllowed } from './settings'

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

export type PreorderCampaignView = PreorderCampaignSummary & {
  productIds: string[]
  members: PreorderCampaignMember[]
}

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
  const rows = await ctx.tx
    .select({ id: product.id, own: product.preorderOwn, limit: product.preorderLimit })
    .from(product)
    .where(eq(product.preorderCampaignId, id))
    .orderBy(asc(product.title))
  const variants = rows.length
    ? await ctx.tx
        .select({
          id: variant.id,
          productId: variant.productId,
          override: variant.preorderOverride,
        })
        .from(variant)
        .where(
          and(
            inArray(
              variant.productId,
              rows.map((r) => r.id),
            ),
            isNull(variant.archivedAt),
          ),
        )
    : []
  const members = rows.map((r): PreorderCampaignMember => {
    const own = variants.filter((v) => v.productId === r.id)
    const on = own.filter((v) => variantAllowsPreorder(v.override)).map((v) => v.id)
    return {
      productId: r.id,
      variantIds: on.length === own.length ? null : on,
      limit: r.own.includes('limit') ? r.limit : null,
    }
  })
  return { ...summary, productIds: rows.map((r) => r.id), members }
}

/**
 * Each member's variants and limit (#1473): variants left out get "never on pre-order" on their
 * own override; a limit becomes the product's own (`preorder_own` holds 'limit').
 */
async function setMemberTerms(tx: StoreTx, members: readonly PreorderCampaignMember[]) {
  const now = new Date()
  for (const m of members) {
    const rows = await tx
      .select({ id: variant.id, override: variant.preorderOverride })
      .from(variant)
      .where(and(eq(variant.productId, m.productId), isNull(variant.archivedAt)))
    for (const v of rows) {
      const allowed = m.variantIds === null || m.variantIds.includes(v.id)
      if (variantAllowsPreorder(v.override) === allowed) continue
      await tx
        .update(variant)
        .set({ preorderOverride: withPreorderAllowed(v.override, allowed), updatedAt: now })
        .where(eq(variant.id, v.id))
    }
    const [p] = await tx
      .select({ own: product.preorderOwn })
      .from(product)
      .where(eq(product.id, m.productId))
    if (!p) continue
    const own = p.own.filter((f) => f !== 'limit')
    await tx
      .update(product)
      .set(
        m.limit === null
          ? { preorderOwn: own, updatedAt: now }
          : { preorderOwn: [...own, 'limit'], preorderLimit: m.limit, updatedAt: now },
      )
      .where(eq(product.id, m.productId))
  }
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
  const { productIds, members, ...fields } = PreorderCampaignCreateSchema.parse(input)
  const [row] = await ctx.tx
    .insert(preorderCampaign)
    .values({ ...fields, storeId: ctx.storeId })
    .returning({ id: preorderCampaign.id })
  if (!row) throw new Error('preorder campaign insert returned nothing')
  await setMembers(ctx.tx, row.id, productIds)
  await setMemberTerms(
    ctx.tx,
    members.filter((m) => productIds.includes(m.productId)),
  )
  return getPreorderCampaign(ctx, row.id)
}

/** The value sent, or the one the campaign has when nothing was sent for it. */
const keep = <T>(next: T | undefined, now: T): T => (next === undefined ? now : next)

export async function updatePreorderCampaign(
  ctx: StoreContext,
  input: PreorderCampaignUpdateInput,
): Promise<PreorderCampaignView> {
  const { id, productIds, members, ...f } = PreorderCampaignUpdateSchema.parse(input)
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
  if (members) {
    await setMemberTerms(
      ctx.tx,
      productIds ? members.filter((m) => productIds.includes(m.productId)) : members,
    )
  }
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
