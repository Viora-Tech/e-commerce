/** SOURCE OF TRUTH: loyalty analytics and activity — WHAT: the program's figures over a date range (revenue and orders from members, orders that used a reward, points issued, redeemed and expired, redemption rate, active and new members, redemptions) and the store-wide activity feed (points moves and tier changes, newest first) / WHY: the Analytics screen and the activity feed read one definition; orders count like the store's sales (no drafts, cancels or tests) */
import {
  customer,
  loyaltyEntry,
  loyaltyRedemption,
  loyaltyTier,
  loyaltyTierChange,
} from '@commerce/db'
import { aliasedTable, and, desc, eq, lt, sql } from 'drizzle-orm'
import type { StoreContext } from '../context'

export type LoyaltyAnalytics = {
  from: Date
  to: Date
  /** Total of orders placed in the range by members (joined by then). */
  memberRevenuePaise: number
  memberOrders: number
  /** Orders in the range that used a loyalty reward code. */
  ordersWithRewards: number
  pointsIssued: number
  pointsRedeemed: number
  pointsExpired: number
  /** Points redeemed ÷ points issued in the range (0 to 1; 0 when nothing was issued). */
  redemptionRate: number
  /** Members who earned, spent or ordered in the range. */
  activeMembers: number
  newMembers: number
  redemptions: number
}

/** The program's figures for `[from, to)`. */
export async function loyaltyAnalytics(
  ctx: StoreContext,
  range: { from: Date; to: Date },
): Promise<LoyaltyAnalytics> {
  const from = range.from.toISOString()
  const to = range.to.toISOString()
  const [orders] = await ctx.tx.execute<{
    revenue: number
    orders: number
    with_rewards: number
  }>(sql`
    select coalesce(sum(o.total_paise), 0)::bigint::int as revenue, count(*)::int as orders,
      count(*) filter (where exists (
        select 1 from discount_usage du join loyalty_redemption lr on lr.discount_id = du.discount_id
        where du.order_id = o.id))::int as with_rewards
    from "order" o
    join loyalty_member m on m.customer_id = o.customer_id and m.joined_at <= o.placed_at
    where o.store_id = ${ctx.storeId} and o.status not in ('draft', 'cancelled') and not o.is_test
      and o.placed_at >= ${from}::timestamptz and o.placed_at < ${to}::timestamptz`)
  const [points] = await ctx.tx.execute<{ issued: number; redeemed: number; expired: number }>(sql`
    select
      coalesce(sum(points) filter (where points > 0 and source not in ('redemption_refund')), 0)::int as issued,
      coalesce(-sum(points) filter (where source in ('redemption', 'redemption_refund')), 0)::int as redeemed,
      coalesce(-sum(points) filter (where source = 'expiry'), 0)::int as expired
    from loyalty_entry
    where store_id = ${ctx.storeId} and status = 'credited'
      and coalesce(credited_at, created_at) >= ${from}::timestamptz
      and coalesce(credited_at, created_at) < ${to}::timestamptz`)
  const [members] = await ctx.tx.execute<{ active: number; joined: number }>(sql`
    select
      (select count(distinct c) from (
        select customer_id as c from loyalty_entry
        where store_id = ${ctx.storeId} and status = 'credited'
          and created_at >= ${from}::timestamptz and created_at < ${to}::timestamptz
        union
        select o.customer_id from "order" o join loyalty_member m on m.customer_id = o.customer_id
        where o.store_id = ${ctx.storeId} and o.status not in ('draft', 'cancelled') and not o.is_test
          and o.placed_at >= ${from}::timestamptz and o.placed_at < ${to}::timestamptz
      ) x)::int as active,
      (select count(*) from loyalty_member where store_id = ${ctx.storeId}
        and joined_at >= ${from}::timestamptz and joined_at < ${to}::timestamptz)::int as joined`)
  const [red] = await ctx.tx
    .select({ n: sql<number>`count(*)::int` })
    .from(loyaltyRedemption)
    .where(
      and(
        sql`${loyaltyRedemption.createdAt} >= ${from}::timestamptz`,
        sql`${loyaltyRedemption.createdAt} < ${to}::timestamptz`,
        sql`${loyaltyRedemption.status} <> 'cancelled'`,
      ),
    )
  const issued = Number(points?.issued ?? 0)
  const redeemed = Math.max(0, Number(points?.redeemed ?? 0))
  return {
    from: range.from,
    to: range.to,
    memberRevenuePaise: Number(orders?.revenue ?? 0),
    memberOrders: Number(orders?.orders ?? 0),
    ordersWithRewards: Number(orders?.with_rewards ?? 0),
    pointsIssued: issued,
    pointsRedeemed: redeemed,
    pointsExpired: Math.max(0, Number(points?.expired ?? 0)),
    redemptionRate: issued > 0 ? Math.min(1, redeemed / issued) : 0,
    activeMembers: Number(members?.active ?? 0),
    newMembers: Number(members?.joined ?? 0),
    redemptions: red?.n ?? 0,
  }
}

export type LoyaltyActivityItem =
  | {
      kind: 'points'
      id: string
      at: Date
      customerId: string
      customerName: string | null
      customerEmail: string | null
      source: string
      status: string
      points: number
      reason: string
    }
  | {
      kind: 'tier'
      id: string
      at: Date
      customerId: string
      customerName: string | null
      customerEmail: string | null
      fromTier: string | null
      toTier: string | null
    }

/**
 * Store-wide activity, newest first: points moves (earned, redeemed, taken back, expired...)
 * and tier changes. Page with `before` = the last item's `at`.
 */
export async function loyaltyActivity(
  ctx: StoreContext,
  input: { before?: Date | null; limit?: number } = {},
): Promise<LoyaltyActivityItem[]> {
  const limit = Math.min(100, Math.max(1, input.limit ?? 50))
  const entries = await ctx.tx
    .select({
      id: loyaltyEntry.id,
      at: loyaltyEntry.createdAt,
      customerId: loyaltyEntry.customerId,
      customerName: customer.name,
      customerEmail: customer.email,
      source: loyaltyEntry.source,
      status: loyaltyEntry.status,
      points: loyaltyEntry.points,
      reason: loyaltyEntry.reason,
    })
    .from(loyaltyEntry)
    .innerJoin(customer, eq(customer.id, loyaltyEntry.customerId))
    .where(input.before ? lt(loyaltyEntry.createdAt, input.before) : undefined)
    .orderBy(desc(loyaltyEntry.createdAt), desc(loyaltyEntry.id))
    .limit(limit)
  const fromTier = aliasedTable(loyaltyTier, 'from_tier')
  const toTier = aliasedTable(loyaltyTier, 'to_tier')
  const tiers = await ctx.tx
    .select({
      id: loyaltyTierChange.id,
      at: loyaltyTierChange.createdAt,
      customerId: loyaltyTierChange.customerId,
      customerName: customer.name,
      customerEmail: customer.email,
      fromTier: fromTier.name,
      toTier: toTier.name,
    })
    .from(loyaltyTierChange)
    .innerJoin(customer, eq(customer.id, loyaltyTierChange.customerId))
    .leftJoin(fromTier, eq(fromTier.id, loyaltyTierChange.fromTierId))
    .leftJoin(toTier, eq(toTier.id, loyaltyTierChange.toTierId))
    .where(input.before ? lt(loyaltyTierChange.createdAt, input.before) : undefined)
    .orderBy(desc(loyaltyTierChange.createdAt))
    .limit(limit)
  const items: LoyaltyActivityItem[] = [
    ...entries.map((e) => ({ kind: 'points' as const, ...e })),
    ...tiers.map((t) => ({ kind: 'tier' as const, ...t })),
  ]
  return items.sort((a, b) => b.at.getTime() - a.at.getTime()).slice(0, limit)
}
