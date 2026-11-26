/** SOURCE OF TRUTH: the affiliate portal's performance chart and commission list — WHAT: referrals, sales, commission and clicks per day, week or month between two India dates, and the affiliate's commissions filtered by source, status and dates / WHY: the portal (affiliate.<store domain>) shows an affiliate only their own figures, buyer masked, like UpPromote's dashboard and Commission page */
import { address, order, type StoreTx } from '@commerce/db'
import { and, desc, eq, inArray, sql } from 'drizzle-orm'
import type { PortalSale } from './portal'
import { affiliate, affiliateClickDay, affiliateCommission } from './schema'
import { type CommissionStatus, maskBuyer } from './settings'

/** `YYYY-MM-DD`. */
const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/

export type ActivityUnit = 'day' | 'week' | 'month'

export type ActivityPoint = {
  /** Start of the day, week (Monday) or month, `YYYY-MM-DD`, India time. */
  period: string
  /** Orders their link or code brought (reversed ones left out). */
  referrals: number
  salesPaise: number
  commissionPaise: number
  clicks: number
}

const DAY_MS = 86_400_000

const isoDay = (d: Date): string => d.toISOString().slice(0, 10)

/** A `YYYY-MM-DD` as a UTC midnight, or null when it is not a real date. */
export function parseDay(raw: unknown): Date | null {
  if (typeof raw !== 'string' || !ISO_DAY.test(raw)) return null
  const d = new Date(`${raw}T00:00:00Z`)
  return Number.isNaN(d.getTime()) || isoDay(d) !== raw ? null : d
}

/** Today in India, `YYYY-MM-DD`. */
export function indiaToday(now = new Date()): string {
  return isoDay(new Date(now.getTime() + 330 * 60_000))
}

/** Days from `from` to `to`, both included. */
export function spanDays(from: string, to: string): number {
  const a = parseDay(from)
  const b = parseDay(to)
  if (!a || !b) return 0
  return Math.round((b.getTime() - a.getTime()) / DAY_MS) + 1
}

/** One bar per day up to three months, per week up to a year and a bit, per month beyond. */
export function unitFor(days: number): ActivityUnit {
  if (days <= 92) return 'day'
  if (days <= 400) return 'week'
  return 'month'
}

/** The start of the period `day` falls in: itself, its Monday, or the 1st of its month. */
export function periodOf(day: string, unit: ActivityUnit): string {
  const d = parseDay(day)
  if (!d) return day
  if (unit === 'month') return `${day.slice(0, 7)}-01`
  if (unit === 'week') {
    const back = (d.getUTCDay() + 6) % 7
    return isoDay(new Date(d.getTime() - back * DAY_MS))
  }
  return day
}

/** Every period between two days, oldest first, so the chart has no gaps. */
export function periodsBetween(from: string, to: string, unit: ActivityUnit): string[] {
  const a = parseDay(from)
  const b = parseDay(to)
  if (!a || !b || a > b) return []
  const out: string[] = []
  for (let t = a.getTime(); t <= b.getTime(); t += DAY_MS) {
    const p = periodOf(isoDay(new Date(t)), unit)
    if (out[out.length - 1] !== p) out.push(p)
  }
  return out
}

/** Sums rows into the periods between two days; days outside them are dropped. */
export function fillActivity(
  from: string,
  to: string,
  unit: ActivityUnit,
  sales: { day: string; referrals: number; salesPaise: number; commissionPaise: number }[],
  clicks: { day: string; clicks: number }[],
): ActivityPoint[] {
  const points = new Map<string, ActivityPoint>(
    periodsBetween(from, to, unit).map((period) => [
      period,
      { period, referrals: 0, salesPaise: 0, commissionPaise: 0, clicks: 0 },
    ]),
  )
  for (const s of sales) {
    const p = points.get(periodOf(s.day, unit))
    if (!p) continue
    p.referrals += s.referrals
    p.salesPaise += s.salesPaise
    p.commissionPaise += s.commissionPaise
  }
  for (const c of clicks) {
    const p = points.get(periodOf(c.day, unit))
    if (p) p.clicks += c.clicks
  }
  return [...points.values()]
}

/** `(placed_at at time zone 'Asia/Kolkata')::date` as text. */
const placedDay = sql<string>`to_char((${affiliateCommission.placedAt} at time zone 'Asia/Kolkata')::date, 'YYYY-MM-DD')`

/**
 * One affiliate's referrals, sales, commission and clicks between two India days (both
 * included), per day, week or month as the span asks. Reversed commissions count nowhere.
 */
export async function portalActivity(
  tx: StoreTx,
  affiliateId: string,
  range: { from: string; to: string },
): Promise<{ unit: ActivityUnit; points: ActivityPoint[] }> {
  const unit = unitFor(spanDays(range.from, range.to))
  if (!parseDay(range.from) || !parseDay(range.to)) return { unit, points: [] }
  const sales = await tx
    .select({
      day: placedDay,
      referrals: sql<number>`count(*)::int`,
      salesPaise: sql<number>`coalesce(sum(${affiliateCommission.basePaise}), 0)::int`,
      commissionPaise: sql<number>`coalesce(sum(${affiliateCommission.commissionPaise}), 0)::int`,
    })
    .from(affiliateCommission)
    .where(
      and(
        eq(affiliateCommission.affiliateId, affiliateId),
        sql`${affiliateCommission.status} <> 'reversed'`,
        sql`(${affiliateCommission.placedAt} at time zone 'Asia/Kolkata')::date between ${range.from}::date and ${range.to}::date`,
      ),
    )
    .groupBy(placedDay)
  const clicks = await tx
    .select({ day: affiliateClickDay.day, clicks: affiliateClickDay.clicks })
    .from(affiliateClickDay)
    .where(
      and(
        eq(affiliateClickDay.affiliateId, affiliateId),
        sql`${affiliateClickDay.day} between ${range.from}::date and ${range.to}::date`,
      ),
    )
  return { unit, points: fillActivity(range.from, range.to, unit, sales, clicks) }
}

export type PortalCommissionFilters = {
  source?: PortalSale['source'] | undefined
  status?: CommissionStatus | undefined
  /** India days, both included. */
  from?: string | undefined
  to?: string | undefined
  limit?: number | undefined
}

/** Their commissions, newest first, filtered. Never the order number or the buyer's details. */
export async function portalCommissions(
  tx: StoreTx,
  affiliateId: string,
  filters: PortalCommissionFilters = {},
): Promise<PortalSale[]> {
  const from = parseDay(filters.from) ? filters.from : undefined
  const to = parseDay(filters.to) ? filters.to : undefined
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
    .where(
      and(
        eq(affiliateCommission.affiliateId, affiliateId),
        filters.source ? eq(affiliateCommission.source, filters.source) : undefined,
        filters.status ? inArray(affiliateCommission.status, [filters.status]) : undefined,
        from
          ? sql`(${affiliateCommission.placedAt} at time zone 'Asia/Kolkata')::date >= ${from}::date`
          : undefined,
        to
          ? sql`(${affiliateCommission.placedAt} at time zone 'Asia/Kolkata')::date <= ${to}::date`
          : undefined,
      ),
    )
    .orderBy(desc(affiliateCommission.placedAt))
    .limit(Math.min(Math.max(filters.limit ?? 200, 1), 1000))
  return rows.map(({ name, flag, ...r }) => ({
    ...r,
    buyer: maskBuyer(name),
    held: Boolean(flag) && r.status === 'pending',
  }))
}

/** The affiliate edits their own name and main profile link from the portal's Settings. */
export async function updateAffiliateProfile(
  tx: StoreTx,
  affiliateId: string,
  input: { name: string; social: string },
): Promise<boolean> {
  const name = input.name.trim().slice(0, 120)
  if (!name) return false
  const rows = await tx
    .update(affiliate)
    .set({ name, social: input.social.trim().slice(0, 200), updatedAt: new Date() })
    .where(eq(affiliate.id, affiliateId))
    .returning({ id: affiliate.id })
  return rows.length > 0
}
