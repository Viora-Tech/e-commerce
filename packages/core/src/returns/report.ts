/** SOURCE OF TRUTH: return reasons report — WHAT: for the last N days, customer returns by reason (requests, units, value), the products returned most with their top reason, and how many asked for an exchange or were auto-approved / WHY: the COD & RTO app's "Return reasons" page shows merchants which products and reasons cost them, the way Return Prime's reports do; RTOs are left out (they have no reason) */
import { orderLine, returnRequest, returnRequestLine, variant } from '@commerce/db'
import { and, asc, count, desc, eq, gte, sql } from 'drizzle-orm'
import type { StoreContext } from '../context'
import type { ReturnReason } from './policy'

const DAY_MS = 86_400_000

export async function returnReasonsReport(ctx: StoreContext, days = 90, now = new Date()) {
  const since = new Date(now.getTime() - days * DAY_MS)
  const where = and(eq(returnRequest.kind, 'return'), gte(returnRequest.requestedAt, since))
  const units = sql<number>`coalesce(sum(${returnRequestLine.quantity}), 0)::int`
  const value = sql<number>`coalesce(sum(${returnRequestLine.quantity} * ${orderLine.unitPricePaise}), 0)::int`
  const [byReason, byProduct, [totals]] = await Promise.all([
    ctx.tx
      .select({
        reason: returnRequest.reason,
        returns: sql<number>`count(distinct ${returnRequest.id})::int`,
        units,
        valuePaise: value,
      })
      .from(returnRequest)
      .innerJoin(returnRequestLine, eq(returnRequestLine.returnRequestId, returnRequest.id))
      .innerJoin(orderLine, eq(orderLine.id, returnRequestLine.orderLineId))
      .where(where)
      .groupBy(returnRequest.reason)
      .orderBy(desc(sql`count(distinct ${returnRequest.id})`), asc(returnRequest.reason)),
    ctx.tx
      .select({
        productId: variant.productId,
        title: sql<string>`min(${orderLine.title})`,
        returns: sql<number>`count(distinct ${returnRequest.id})::int`,
        units,
        valuePaise: value,
        topReason: sql<string | null>`mode() within group (order by ${returnRequest.reason})`,
      })
      .from(returnRequest)
      .innerJoin(returnRequestLine, eq(returnRequestLine.returnRequestId, returnRequest.id))
      .innerJoin(orderLine, eq(orderLine.id, returnRequestLine.orderLineId))
      .innerJoin(variant, eq(variant.id, orderLine.variantId))
      .where(where)
      .groupBy(variant.productId)
      .orderBy(desc(sql`count(distinct ${returnRequest.id})`))
      .limit(10),
    ctx.tx
      .select({
        returns: count(),
        exchanges: sql<number>`count(*) filter (where ${returnRequest.preferredResolution} = 'exchange')::int`,
        autoApproved: sql<number>`count(*) filter (where ${returnRequest.autoApproved})::int`,
      })
      .from(returnRequest)
      .where(where),
  ])
  const total = Number(totals?.returns ?? 0)
  return {
    days,
    returns: total,
    exchanges: Number(totals?.exchanges ?? 0),
    autoApproved: Number(totals?.autoApproved ?? 0),
    reasons: byReason.map((r) => ({
      reason: (r.reason ?? 'other') as ReturnReason,
      returns: Number(r.returns),
      units: Number(r.units),
      valuePaise: Number(r.valuePaise),
      sharePercent: total > 0 ? Math.round((Number(r.returns) / total) * 1000) / 10 : 0,
    })),
    products: byProduct.map((p) => ({
      productId: p.productId,
      title: p.title,
      returns: Number(p.returns),
      units: Number(p.units),
      valuePaise: Number(p.valuePaise),
      topReason: (p.topReason ?? null) as ReturnReason | null,
    })),
  }
}
