/** SOURCE OF TRUTH: the affiliate's own dashboard — WHAT: figures for a date range, their referred sales with the buyer masked, their payouts and what comes next / WHY: the storefront portal must show an affiliate only their own money, never a shopper's details */
import { address, order, type StoreTx } from '@commerce/db'
import { and, asc, desc, eq, gte, isNull, ne, sql } from 'drizzle-orm'
import { payoutCandidates } from './payouts'
import { affiliate, affiliateClickDay, affiliateCommission, affiliatePayout } from './schema'
import {
  type CommissionStatus,
  conversionPercent,
  maskBuyer,
  type StoreAffiliateSettings,
} from './settings'

/** The dashboard's date ranges, in days; `all` is since they joined. */
export const PORTAL_RANGES = ['7d', '30d', '90d', 'all'] as const
export type PortalRange = (typeof PORTAL_RANGES)[number]

/** `?range=` as given, or the 30-day default. */
export function portalRange(raw: unknown): PortalRange {
  return (PORTAL_RANGES as readonly unknown[]).includes(raw) ? (raw as PortalRange) : '30d'
}

const DAY_MS = 86_400_000

/** The start of a range, or null for all time. */
export function rangeStart(range: PortalRange, now = new Date()): Date | null {
  if (range === 'all') return null
  return new Date(now.getTime() - Number.parseInt(range, 10) * DAY_MS)
}

export type PortalStats = {
  clicks: number
  orders: number
  /** Net sales their orders brought (after discount, without GST). */
  salesPaise: number
  /** Commission on those orders, whatever stage it is at. Reversed ones count nowhere. */
  earnedPaise: number
  /** Orders per click, as a percentage; null with no clicks. */
  conversion: number | null
}

/** One affiliate's clicks, orders, sales and commission since `since` (or all time). */
export async function portalStats(
  tx: StoreTx,
  affiliateId: string,
  since: Date | null,
): Promise<PortalStats> {
  const [c] = await tx
    .select({
      orders: sql<number>`count(*)::int`,
      sales: sql<number>`coalesce(sum(${affiliateCommission.basePaise}), 0)::int`,
      earned: sql<number>`coalesce(sum(${affiliateCommission.commissionPaise}), 0)::int`,
    })
    .from(affiliateCommission)
    .where(
      and(
        eq(affiliateCommission.affiliateId, affiliateId),
        ne(affiliateCommission.status, 'reversed'),
        since ? gte(affiliateCommission.placedAt, since) : undefined,
      ),
    )
  let clicks = 0
  if (since) {
    const [k] = await tx
      .select({ n: sql<number>`coalesce(sum(${affiliateClickDay.clicks}), 0)::int` })
      .from(affiliateClickDay)
      .where(
        and(
          eq(affiliateClickDay.affiliateId, affiliateId),
          sql`${affiliateClickDay.day} >= (${since.toISOString()}::timestamptz at time zone 'Asia/Kolkata')::date`,
        ),
      )
    clicks = k?.n ?? 0
  } else {
    const [k] = await tx
      .select({ n: affiliate.clicks })
      .from(affiliate)
      .where(eq(affiliate.id, affiliateId))
    clicks = k?.n ?? 0
  }
  const orders = c?.orders ?? 0
  return {
    clicks,
    orders,
    salesPaise: c?.sales ?? 0,
    earnedPaise: c?.earned ?? 0,
    conversion: conversionPercent(orders, clicks),
  }
}

export type PortalSale = {
  id: string
  placedAt: Date
  /** "R••• S." from the shipping name; null when the order has none. */
  buyer: string | null
  source: 'link' | 'coupon' | 'lifetime'
  status: CommissionStatus
  basePaise: number
  commissionPaise: number
  /** When a pending one can be approved (delivery plus the hold); null before delivery. */
  eligibleAt: Date | null
  /** Held for the store to look at (a fraud check). */
  held: boolean
  reversedReason: string | null
}

/** Their newest referred orders. Never the order number, email, phone or address. */
export async function portalSales(
  tx: StoreTx,
  affiliateId: string,
  limit = 20,
): Promise<PortalSale[]> {
  const rows = await tx
    .select({
      id: affiliateCommission.id,
      placedAt: affiliateCommission.placedAt,
      name: address.name,
      source: affiliateCommission.source,
      status: affiliateCommission.status,
      basePaise: affiliateCommission.basePaise,
      commissionPaise: affiliateCommission.commissionPaise,
      eligibleAt: affiliateCommission.eligibleAt,
      flag: affiliateCommission.flag,
      reversedReason: affiliateCommission.reversedReason,
    })
    .from(affiliateCommission)
    .innerJoin(order, eq(order.id, affiliateCommission.orderId))
    .leftJoin(address, eq(address.id, order.shippingAddressId))
    .where(eq(affiliateCommission.affiliateId, affiliateId))
    .orderBy(desc(affiliateCommission.placedAt))
    .limit(limit)
  return rows.map(({ name, flag, ...r }) => ({
    ...r,
    buyer: maskBuyer(name),
    // A self-referral is reversed with its finding as the flag; only a live one is "held".
    held: Boolean(flag) && r.status === 'pending',
  }))
}

export type PortalPayout = {
  id: string
  status: 'pending' | 'paid'
  grossPaise: number
  tdsPaise: number
  clawbackPaise: number
  gstPaise: number
  netPaise: number
  reference: string
  createdAt: Date
  paidAt: Date | null
}

/** Their payouts, newest first. */
export async function portalPayouts(
  tx: StoreTx,
  affiliateId: string,
  limit = 12,
): Promise<PortalPayout[]> {
  return tx
    .select({
      id: affiliatePayout.id,
      status: affiliatePayout.status,
      grossPaise: affiliatePayout.grossPaise,
      tdsPaise: affiliatePayout.tdsPaise,
      clawbackPaise: affiliatePayout.clawbackPaise,
      gstPaise: affiliatePayout.gstPaise,
      netPaise: affiliatePayout.netPaise,
      reference: affiliatePayout.reference,
      createdAt: affiliatePayout.createdAt,
      paidAt: affiliatePayout.paidAt,
    })
    .from(affiliatePayout)
    .where(eq(affiliatePayout.affiliateId, affiliateId))
    .orderBy(desc(affiliatePayout.createdAt))
    .limit(limit)
}

export type PayoutOutlook = {
  /** Approved, not in a payout yet, after clawbacks, GST and TDS: what the next payout would be. */
  readyPaise: number
  /** Why it cannot be paid yet; null when the store can pay it now. */
  blocker: 'below_minimum' | 'no_details' | 'no_pan' | 'review' | null
  minPayoutPaise: number
  /** A payout the store made and has not marked paid yet. */
  processingPaise: number
  /** The next pending commissions to clear the hold: when, and how much clears then. */
  nextClear: { at: Date; paise: number } | null
}

/** What their next payout looks like, from the same rules the merchant's Payouts page uses. */
export async function payoutOutlook(
  tx: StoreTx,
  affiliateId: string,
  settings: StoreAffiliateSettings,
  now = new Date(),
): Promise<PayoutOutlook> {
  const [candidate] = await payoutCandidates(tx, settings, now, affiliateId)
  const [processing] = await tx
    .select({ n: sql<number>`coalesce(sum(${affiliatePayout.netPaise}), 0)::int` })
    .from(affiliatePayout)
    .where(and(eq(affiliatePayout.affiliateId, affiliateId), eq(affiliatePayout.status, 'pending')))
  const [first] = await tx
    .select({ at: affiliateCommission.eligibleAt })
    .from(affiliateCommission)
    .where(
      and(
        eq(affiliateCommission.affiliateId, affiliateId),
        eq(affiliateCommission.status, 'pending'),
        isNull(affiliateCommission.flag),
        sql`${affiliateCommission.eligibleAt} is not null`,
      ),
    )
    .orderBy(asc(affiliateCommission.eligibleAt))
    .limit(1)
  let nextClear: PayoutOutlook['nextClear'] = null
  if (first?.at) {
    // Everything clearing on the same India day as the first one.
    const [d] = await tx
      .select({ n: sql<number>`coalesce(sum(${affiliateCommission.commissionPaise}), 0)::int` })
      .from(affiliateCommission)
      .where(
        and(
          eq(affiliateCommission.affiliateId, affiliateId),
          eq(affiliateCommission.status, 'pending'),
          isNull(affiliateCommission.flag),
          sql`(${affiliateCommission.eligibleAt} at time zone 'Asia/Kolkata')::date = (${first.at.toISOString()}::timestamptz at time zone 'Asia/Kolkata')::date`,
        ),
      )
    nextClear = { at: first.at, paise: d?.n ?? 0 }
  }
  return {
    readyPaise: candidate?.netPaise ?? 0,
    blocker: candidate ? candidate.blocker : null,
    minPayoutPaise: settings.minPayoutPaise,
    processingPaise: processing?.n ?? 0,
    nextClear,
  }
}
