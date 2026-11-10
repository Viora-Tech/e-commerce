/** SOURCE OF TRUTH: preorderOverview, PreorderOverview, PreorderProductRow
 * WHAT:  Products › Pre-orders overview: the last 30 days, every pre-order product with its
 *        limit and what is left, every campaign, and the markets and locations for the form.
 * WHY:   Split from `./campaigns-service` (campaign reads and writes) by concern.
 * WHERE: `preorders.overview` (api), Products › Pre-orders (admin).
 */
import { location, market, order, orderLine, product, sellableStock, variant } from '@commerce/db'
import { and, asc, desc, eq, gte, inArray, isNotNull, isNull, ne, or, sql } from 'drizzle-orm'
import { notSystemTest } from '../catalog/system-test'
import type { StoreContext } from '../context'
import { countedOrder, preorderLine } from './campaign-orders'
import { listPreorderCampaigns, type PreorderCampaignSummary } from './campaigns-service'
import { resolvePreorderSettings } from './settings'

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
      .where(and(preorderLine, countedOrder, gte(order.placedAt, since))),
    listPreorderCampaigns(ctx),
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
      .where(and(preorderLine, countedOrder, inArray(variant.productId, ids.length ? ids : [NONE])))
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
