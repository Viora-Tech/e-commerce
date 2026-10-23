/** SOURCE OF TRUTH: affiliate reporting — WHAT: the overview, per-affiliate totals and the commissions ledger / WHY: the admin pages and the storefront portal show the same figures */
import { order, type StoreTx } from '@commerce/db'
import { and, desc, eq, sql } from 'drizzle-orm'
import { affiliate, affiliateCommission } from './schema'
import type { CommissionStatus } from './settings'

export type AffiliateTotals = {
  clicks: number
  orders: number
  salesPaise: number
  pendingPaise: number
  /** Approved, not yet paid. */
  approvedPaise: number
  paidPaise: number
  tdsPaise: number
}

const sumWhere = (status: CommissionStatus) =>
  sql<number>`coalesce(sum(${affiliateCommission.commissionPaise}) filter (where ${affiliateCommission.status} = ${status}), 0)::int`

/** One affiliate's figures (`affiliateId`), or the whole program's (none). Reversed ones count nowhere. */
export async function affiliateTotals(tx: StoreTx, affiliateId?: string): Promise<AffiliateTotals> {
  const [c] = await tx
    .select({
      orders: sql<number>`count(*) filter (where ${affiliateCommission.status} <> 'reversed')::int`,
      sales: sql<number>`coalesce(sum(${affiliateCommission.basePaise}) filter (where ${affiliateCommission.status} <> 'reversed'), 0)::int`,
      pending: sumWhere('pending'),
      approved: sumWhere('approved'),
      paid: sumWhere('paid'),
      tds: sql<number>`coalesce(sum(${affiliateCommission.tdsPaise}) filter (where ${affiliateCommission.status} in ('approved', 'paid')), 0)::int`,
    })
    .from(affiliateCommission)
    .where(affiliateId ? eq(affiliateCommission.affiliateId, affiliateId) : undefined)
  const [k] = await tx
    .select({ clicks: sql<number>`coalesce(sum(${affiliate.clicks}), 0)::int` })
    .from(affiliate)
    .where(affiliateId ? eq(affiliate.id, affiliateId) : undefined)
  return {
    clicks: k?.clicks ?? 0,
    orders: c?.orders ?? 0,
    salesPaise: c?.sales ?? 0,
    pendingPaise: c?.pending ?? 0,
    approvedPaise: c?.approved ?? 0,
    paidPaise: c?.paid ?? 0,
    tdsPaise: c?.tds ?? 0,
  }
}

export type TopAffiliate = {
  id: string
  name: string
  code: string
  orders: number
  salesPaise: number
  commissionPaise: number
}

/** Best affiliates by net sales they brought (reversed orders left out). */
export async function topAffiliates(tx: StoreTx, limit = 5): Promise<TopAffiliate[]> {
  return tx
    .select({
      id: affiliate.id,
      name: affiliate.name,
      code: affiliate.code,
      orders: sql<number>`count(${affiliateCommission.id})::int`,
      salesPaise: sql<number>`coalesce(sum(${affiliateCommission.basePaise}), 0)::int`,
      commissionPaise: sql<number>`coalesce(sum(${affiliateCommission.commissionPaise}), 0)::int`,
    })
    .from(affiliateCommission)
    .innerJoin(affiliate, eq(affiliate.id, affiliateCommission.affiliateId))
    .where(sql`${affiliateCommission.status} <> 'reversed'`)
    .groupBy(affiliate.id, affiliate.name, affiliate.code)
    .orderBy(desc(sql`sum(${affiliateCommission.basePaise})`))
    .limit(limit)
}

/** Per affiliate in the list: orders and money earned so far, keyed by affiliate id. */
export async function totalsByAffiliate(
  tx: StoreTx,
): Promise<Map<string, { orders: number; earnedPaise: number; pendingPaise: number }>> {
  const rows = await tx
    .select({
      id: affiliateCommission.affiliateId,
      orders: sql<number>`count(*) filter (where ${affiliateCommission.status} <> 'reversed')::int`,
      earned: sql<number>`coalesce(sum(${affiliateCommission.commissionPaise}) filter (where ${affiliateCommission.status} in ('approved', 'paid')), 0)::int`,
      pending: sumWhere('pending'),
    })
    .from(affiliateCommission)
    .groupBy(affiliateCommission.affiliateId)
  return new Map(
    rows.map((r) => [r.id, { orders: r.orders, earnedPaise: r.earned, pendingPaise: r.pending }]),
  )
}

export type LedgerRow = {
  id: string
  affiliateId: string
  affiliateName: string
  affiliateCode: string
  orderId: string
  orderNumber: number
  source: 'link' | 'coupon' | 'lifetime'
  status: CommissionStatus
  basePaise: number
  commissionPaise: number
  tdsPaise: number
  flag: string | null
  reversedReason: string | null
  placedAt: Date
  eligibleAt: Date | null
  payoutId: string | null
}

/** Newest first; optionally one affiliate's. */
export async function commissionLedger(
  tx: StoreTx,
  opts: { affiliateId?: string | undefined; limit?: number | undefined } = {},
): Promise<LedgerRow[]> {
  return tx
    .select({
      id: affiliateCommission.id,
      affiliateId: affiliateCommission.affiliateId,
      affiliateName: affiliate.name,
      affiliateCode: affiliate.code,
      orderId: affiliateCommission.orderId,
      orderNumber: order.number,
      source: affiliateCommission.source,
      status: affiliateCommission.status,
      basePaise: affiliateCommission.basePaise,
      commissionPaise: affiliateCommission.commissionPaise,
      tdsPaise: affiliateCommission.tdsPaise,
      flag: affiliateCommission.flag,
      reversedReason: affiliateCommission.reversedReason,
      placedAt: affiliateCommission.placedAt,
      eligibleAt: affiliateCommission.eligibleAt,
      payoutId: affiliateCommission.payoutId,
    })
    .from(affiliateCommission)
    .innerJoin(affiliate, eq(affiliate.id, affiliateCommission.affiliateId))
    .innerJoin(order, eq(order.id, affiliateCommission.orderId))
    .where(
      and(opts.affiliateId ? eq(affiliateCommission.affiliateId, opts.affiliateId) : undefined),
    )
    .orderBy(desc(affiliateCommission.placedAt))
    .limit(opts.limit ?? 1000)
}
