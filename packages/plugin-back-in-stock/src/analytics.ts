import { type StoreTx, variant } from '@commerce/db'
import { and, eq, inArray, sql } from 'drizzle-orm'
import { backInStockSignup } from './schema'

/**
 * The Analytics numbers (Essential's "Waiting for restock · New sign-ups · Notified · Orders from
 * emails"), for a period and the same-length period before it. "Orders from alerts" counts orders
 * placed with the signup's email, for the alerted variant, within `ORDER_WINDOW_DAYS` of its alert
 * and not cancelled; nothing is stored for it, so it also counts alerts sent before this existed.
 */

/** How long after an alert an order with that variant still counts as coming from it. */
export const ORDER_WINDOW_DAYS = 14

const LIVE = ['confirmed', 'pending_confirmation'] as const

/** A Date as a timestamptz parameter (the driver binds raw sql parameters as text). */
const iso = (d: Date) => sql`${d.toISOString()}::timestamptz`

export type AnalyticsPeriod = { from: Date; to: Date }

export type AnalyticsTotals = {
  newSignups: number
  notified: number
  orders: number
  revenuePaise: number
}

export type AnalyticsSummary = {
  /** Waiting right now (confirmed or pending): not a period figure. */
  waiting: number
  current: AnalyticsTotals
  previous: AnalyticsTotals
}

/** The period of the same length that ends where `period` starts. */
export function previousPeriod(period: AnalyticsPeriod): AnalyticsPeriod {
  const span = period.to.getTime() - period.from.getTime()
  return { from: new Date(period.from.getTime() - span), to: period.from }
}

/** Change against the previous period as a whole percent; null when there is nothing to compare. */
export function percentChange(now: number, before: number): number | null {
  if (before === 0) return now === 0 ? 0 : null
  return Math.round(((now - before) / before) * 100)
}

async function totalsFor(tx: StoreTx, storeId: string, p: AnalyticsPeriod) {
  const s = backInStockSignup
  const [counts] = await tx
    .select({
      newSignups: sql<number>`count(*) filter (where ${s.createdAt} >= ${iso(p.from)} and ${s.createdAt} < ${iso(p.to)})::int`,
      notified: sql<number>`count(*) filter (where ${s.notifiedAt} >= ${iso(p.from)} and ${s.notifiedAt} < ${iso(p.to)})::int`,
    })
    .from(s)
    .where(eq(s.storeId, storeId))
  // One row per (order, alerted signup) match, then distinct orders and their totals.
  const rows = await tx.execute<{ orders: number; revenue: number }>(sql`
    select count(*)::int as orders, coalesce(sum(t.total_paise), 0)::bigint as revenue
    from (
      select distinct o.id, o.total_paise
      from back_in_stock_signup s
      join "order" o on o.store_id = s.store_id
        and s.email is not null and lower(o.email) = s.email
        and o.placed_at >= s.notified_at
        and o.placed_at < s.notified_at + make_interval(days => ${ORDER_WINDOW_DAYS})
        and o.status not in ('cancelled', 'draft')
      join order_line l on l.order_id = o.id and l.variant_id = s.variant_id
      where s.store_id = ${storeId}
        and s.notified_at is not null
        and o.placed_at >= ${iso(p.from)} and o.placed_at < ${iso(p.to)}
    ) t
  `)
  const r = rows[0]
  return {
    newSignups: counts?.newSignups ?? 0,
    notified: counts?.notified ?? 0,
    orders: Number(r?.orders ?? 0),
    revenuePaise: Number(r?.revenue ?? 0),
  }
}

export async function analyticsSummary(
  tx: StoreTx,
  storeId: string,
  period: AnalyticsPeriod,
): Promise<AnalyticsSummary> {
  const [waitingRow] = await tx
    .select({ n: sql<number>`count(*)::int` })
    .from(backInStockSignup)
    .where(and(eq(backInStockSignup.storeId, storeId), inArray(backInStockSignup.status, LIVE)))
  return {
    waiting: waitingRow?.n ?? 0,
    current: await totalsFor(tx, storeId, period),
    previous: await totalsFor(tx, storeId, previousPeriod(period)),
  }
}

export type VariantDemandRow = {
  variantId: string
  productId: string
  /** Waiting now. */
  waiting: number
  /** Signed up within the period. */
  newSignups: number
  /** Alerts sent, ever. */
  notified: number
  /** The oldest live signup's date, or null when nobody waits. */
  waitingSince: Date | null
}

/**
 * One row per variant anyone asked about: the Analytics list (Essential's All · New sign-ups ·
 * Waiting 30+ days tabs filter it on the page). Most waiting first.
 */
export async function demandByVariant(
  tx: StoreTx,
  storeId: string,
  period: AnalyticsPeriod,
  limit = 200,
): Promise<VariantDemandRow[]> {
  const s = backInStockSignup
  const live = sql`${s.status} in ('confirmed', 'pending_confirmation')`
  const rows = await tx
    .select({
      variantId: s.variantId,
      productId: variant.productId,
      waiting: sql<number>`count(*) filter (where ${live})::int`,
      newSignups: sql<number>`count(*) filter (where ${s.createdAt} >= ${iso(period.from)} and ${s.createdAt} < ${iso(period.to)})::int`,
      notified: sql<number>`count(*) filter (where ${s.status} = 'notified')::int`,
      waitingSince: sql<Date | null>`min(${s.createdAt}) filter (where ${live})`,
    })
    .from(s)
    .innerJoin(variant, eq(variant.id, s.variantId))
    .where(eq(s.storeId, storeId))
    .groupBy(s.variantId, variant.productId)
    .orderBy(sql`3 desc`, sql`4 desc`)
    .limit(limit)
  return rows.map((r) => ({
    ...r,
    waitingSince: r.waitingSince ? new Date(r.waitingSince) : null,
  }))
}
