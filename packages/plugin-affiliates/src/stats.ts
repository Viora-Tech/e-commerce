/** SOURCE OF TRUTH: affiliate reporting — WHAT: the overview, per-affiliate totals and the commissions ledger / WHY: the admin pages and the storefront portal show the same figures */
import { order, orderLine, product, type StoreTx, variant } from '@commerce/db'
import { and, desc, eq, sql } from 'drizzle-orm'
import { affiliate, affiliateClickDay, affiliateCommission } from './schema'
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

export type TrendPoint = {
  /** Start of the week (Monday) or month, `YYYY-MM-DD`, India time. */
  period: string
  orders: number
  salesPaise: number
  commissionPaise: number
  clicks: number
}

/**
 * Sales, commission and clicks per week or month, India time, oldest first: the last 12 weeks
 * or 12 months. Optionally one affiliate's or one program's. Reversed commissions are left out.
 */
export async function affiliateTrend(
  tx: StoreTx,
  opts: {
    by: 'week' | 'month'
    affiliateId?: string | undefined
    programId?: string | undefined
  },
): Promise<TrendPoint[]> {
  // Inlined, not a parameter: GROUP BY must see the same expression as SELECT. Only 'week' or 'month'.
  const unit = sql.raw(opts.by === 'week' ? "'week'" : "'month'")
  const span = opts.by === 'week' ? sql`interval '12 weeks'` : sql`interval '12 months'`
  const ist = sql`(${affiliateCommission.placedAt} at time zone 'Asia/Kolkata')`
  const period = sql<string>`to_char(date_trunc(${unit}, ${ist}), 'YYYY-MM-DD')`
  const sales = await tx
    .select({
      period,
      orders: sql<number>`count(*)::int`,
      salesPaise: sql<number>`coalesce(sum(${affiliateCommission.basePaise}), 0)::int`,
      commissionPaise: sql<number>`coalesce(sum(${affiliateCommission.commissionPaise}), 0)::int`,
    })
    .from(affiliateCommission)
    .where(
      and(
        sql`${affiliateCommission.status} <> 'reversed'`,
        sql`${affiliateCommission.placedAt} > now() - ${span}`,
        opts.affiliateId ? eq(affiliateCommission.affiliateId, opts.affiliateId) : undefined,
        opts.programId ? eq(affiliateCommission.programId, opts.programId) : undefined,
      ),
    )
    .groupBy(period)
  const clickPeriod = sql<string>`to_char(date_trunc(${unit}, ${affiliateClickDay.day}::timestamp), 'YYYY-MM-DD')`
  const clicks = await tx
    .select({
      period: clickPeriod,
      clicks: sql<number>`coalesce(sum(${affiliateClickDay.clicks}), 0)::int`,
    })
    .from(affiliateClickDay)
    .innerJoin(affiliate, eq(affiliate.id, affiliateClickDay.affiliateId))
    .where(
      and(
        sql`${affiliateClickDay.day} > (now() at time zone 'Asia/Kolkata')::date - ${span}`,
        opts.affiliateId ? eq(affiliateClickDay.affiliateId, opts.affiliateId) : undefined,
        opts.programId ? eq(affiliate.programId, opts.programId) : undefined,
      ),
    )
    .groupBy(clickPeriod)
  const byPeriod = new Map<string, TrendPoint>()
  for (const s of sales) byPeriod.set(s.period, { ...s, clicks: 0 })
  for (const c of clicks) {
    const p = byPeriod.get(c.period) ?? {
      period: c.period,
      orders: 0,
      salesPaise: 0,
      commissionPaise: 0,
      clicks: 0,
    }
    byPeriod.set(c.period, { ...p, clicks: c.clicks })
  }
  return [...byPeriod.values()].sort((a, b) => a.period.localeCompare(b.period))
}

export type TopProduct = {
  productId: string
  title: string
  orders: number
  units: number
  commissionPaise: number
}

/**
 * Products affiliates sell most, by units, with the commission their orders earned (an order's
 * commission is shared out over its lines by line value). Optionally one program's.
 */
export async function topProducts(
  tx: StoreTx,
  opts: { programId?: string | undefined; limit?: number | undefined } = {},
): Promise<TopProduct[]> {
  const lineValue = sql`${orderLine.unitPricePaise} * ${orderLine.quantity}`
  const orderValue = sql`nullif(sum(${lineValue}) over (partition by ${orderLine.orderId}), 0)`
  const rows = await tx.execute<{
    product_id: string
    title: string
    orders: number
    units: number
    commission: number
  }>(sql`
    select p.id as product_id, p.title as title,
      count(distinct x.order_id)::int as orders,
      sum(x.quantity)::int as units,
      coalesce(round(sum(x.share)), 0)::int as commission
    from (
      select ${orderLine.orderId} as order_id, ${variant.productId} as product_id, ${orderLine.quantity} as quantity,
        ${affiliateCommission.commissionPaise} * ${lineValue} / ${orderValue} as share
      from ${affiliateCommission}
      join ${orderLine} on ${orderLine.orderId} = ${affiliateCommission.orderId}
      join ${variant} on ${variant.id} = ${orderLine.variantId}
      where ${affiliateCommission.status} <> 'reversed'
      ${opts.programId ? sql`and ${affiliateCommission.programId} = ${opts.programId}` : sql``}
    ) x
    join ${product} p on p.id = x.product_id
    group by p.id, p.title
    order by units desc
    limit ${opts.limit ?? 10}
  `)
  return [...rows].map((r) => ({
    productId: r.product_id,
    title: r.title,
    orders: Number(r.orders),
    units: Number(r.units),
    commissionPaise: Number(r.commission),
  }))
}

const csvCell = (v: string | number | null) => {
  const s = v === null ? '' : String(v)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

/** The commissions ledger as CSV (rupees with two decimals), for the merchant's books. */
export async function ledgerCsv(tx: StoreTx): Promise<string> {
  const rows = await commissionLedger(tx, { limit: 50_000 })
  const rupees = (p: number) => (p / 100).toFixed(2)
  const lines = [
    [
      'Placed',
      'Order',
      'Affiliate',
      'Code',
      'Source',
      'Status',
      'Sale (₹)',
      'Commission (₹)',
      'TDS (₹)',
      'Flag',
      'Reversed because',
    ],
    ...rows.map((r) => [
      r.placedAt.toISOString().slice(0, 10),
      `#${r.orderNumber}`,
      r.affiliateName,
      r.affiliateCode,
      r.source,
      r.status,
      rupees(r.basePaise),
      rupees(r.commissionPaise),
      rupees(r.tdsPaise),
      r.flag,
      r.reversedReason,
    ]),
  ]
  return lines.map((l) => l.map(csvCell).join(',')).join('\n')
}
