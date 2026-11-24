/** SOURCE OF TRUTH: loyalty insights extras — WHAT: member revenue by store day with the non-member total (for the loyalty AOV comparison), and the dry run of a points import (which emails match a customer, which are new members, which are unknown) / WHY: the admin Analytics and Members screens; orders count like `loyaltyAnalytics` (no drafts, cancels or tests; "member" means joined by the order's time) */
import { customer, loyaltyMember } from '@commerce/db'
import { inArray, sql } from 'drizzle-orm'
import type { StoreContext } from '../context'

export type LoyaltyRevenueDay = { day: string; memberRevenuePaise: number; memberOrders: number }

export type LoyaltyRevenueSeries = {
  /** One row per store day (IST) that had member orders, oldest first. */
  days: LoyaltyRevenueDay[]
  /** Orders in the range by shoppers who were not members then (guests included). */
  otherRevenuePaise: number
  otherOrders: number
}

/** Member revenue per day for `[from, to)`, and what everyone else spent, for AOV. */
export async function loyaltyRevenueSeries(
  ctx: StoreContext,
  range: { from: Date; to: Date },
): Promise<LoyaltyRevenueSeries> {
  const from = range.from.toISOString()
  const to = range.to.toISOString()
  const rows = await ctx.tx.execute<{
    day: string | null
    member: boolean
    revenue: number
    orders: number
  }>(sql`
    select
      case when m.customer_id is null then null
        else to_char(o.placed_at at time zone 'Asia/Kolkata', 'YYYY-MM-DD') end as day,
      (m.customer_id is not null) as member,
      coalesce(sum(o.total_paise), 0)::bigint::float8 as revenue,
      count(*)::int as orders
    from "order" o
    left join loyalty_member m on m.customer_id = o.customer_id and m.joined_at <= o.placed_at
    where o.store_id = ${ctx.storeId} and o.status not in ('draft', 'cancelled') and not o.is_test
      and o.placed_at >= ${from}::timestamptz and o.placed_at < ${to}::timestamptz
    group by 1, 2
    order by 1`)
  const days: LoyaltyRevenueDay[] = []
  let otherRevenuePaise = 0
  let otherOrders = 0
  for (const r of rows) {
    if (r.member && r.day) {
      days.push({
        day: r.day,
        memberRevenuePaise: Number(r.revenue),
        memberOrders: Number(r.orders),
      })
    } else {
      otherRevenuePaise += Number(r.revenue)
      otherOrders += Number(r.orders)
    }
  }
  return { days, otherRevenuePaise, otherOrders }
}

export type PointImportPreview = {
  /** Rows whose email is a customer of the store. */
  matched: number
  /** Of those, customers not in the program yet (the import makes them members). */
  newMembers: number
  /** Emails with no customer, skipped by the import (first 100). */
  unknown: string[]
  unknownCount: number
}

/** What `importPointBalances` would do with these rows, without changing anything. */
export async function previewPointImport(
  ctx: StoreContext,
  rows: readonly { email: string }[],
): Promise<PointImportPreview> {
  const emails = [...new Set(rows.map((r) => r.email.toLowerCase()))]
  if (emails.length === 0) return { matched: 0, newMembers: 0, unknown: [], unknownCount: 0 }
  const found = await ctx.tx
    .select({ id: customer.id, email: sql<string>`lower(${customer.email})` })
    .from(customer)
    .where(inArray(sql`lower(${customer.email})`, emails))
  const ids = found.map((c) => c.id)
  const members = ids.length
    ? await ctx.tx
        .select({ id: loyaltyMember.customerId })
        .from(loyaltyMember)
        .where(inArray(loyaltyMember.customerId, ids))
    : []
  const known = new Set(found.map((c) => c.email))
  const unknown = emails.filter((e) => !known.has(e))
  return {
    matched: found.length,
    newMembers: found.length - members.length,
    unknown: unknown.slice(0, 100),
    unknownCount: unknown.length,
  }
}
