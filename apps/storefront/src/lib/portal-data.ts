import 'server-only'

import {
  type ActivityPoint,
  type ActivityUnit,
  type AffiliateRow,
  indiaToday,
  listCreatives,
  type PortalCommissionFilters,
  type PortalRange,
  type PortalSale,
  portalActivity,
  portalCommissions,
  portalPayouts,
  programOf,
} from '@commerce/plugin-affiliates/server'
import { inStore } from './store-context'

/*
 * The affiliate portal's page data beyond the dashboard basics (`loadAffiliatePortal`): the
 * performance chart, the filtered commissions, payouts and the store's files. Always the given
 * affiliate's own rows; callers pass the signed-in shopper's record.
 */

const DAY_MS = 86_400_000

/** The first India day of a range: N-1 days before today, or the day they joined for `all`. */
export function rangeFrom(range: PortalRange, joined: Date, now = new Date()): string {
  const today = indiaToday(now)
  if (range === 'all') {
    const first = indiaToday(joined)
    return first < today ? first : today
  }
  const days = Number.parseInt(range, 10)
  return indiaToday(new Date(now.getTime() - (days - 1) * DAY_MS))
}

/** Their chart for a range, one point per day, week or month. */
export async function loadActivity(
  storeId: string,
  affiliate: AffiliateRow,
  range: PortalRange,
): Promise<{ unit: ActivityUnit; points: ActivityPoint[] }> {
  const from = rangeFrom(range, affiliate.approvedAt ?? affiliate.createdAt)
  return inStore(storeId, (tx) => portalActivity(tx, affiliate.id, { from, to: indiaToday() }))
}

/** Their commissions with the Commission page's filters. */
export async function loadCommissions(
  storeId: string,
  affiliateId: string,
  filters: PortalCommissionFilters,
): Promise<PortalSale[]> {
  return inStore(storeId, (tx) => portalCommissions(tx, affiliateId, filters))
}

/** Their payouts, newest first. */
export async function loadPayouts(storeId: string, affiliateId: string, limit = 200) {
  return inStore(storeId, (tx) => portalPayouts(tx, affiliateId, limit))
}

/** The store's files for their program and for every program. */
export async function loadCreatives(storeId: string, affiliate: { programId: string | null }) {
  const rows = await inStore(storeId, async (tx) => {
    const program = await programOf(tx, storeId, affiliate)
    return listCreatives(tx, { programId: program.id })
  })
  return rows.map((c) => ({
    id: c.id,
    url: c.url,
    contentType: c.contentType,
    title: c.title,
    caption: c.caption,
  }))
}

const SOURCES = ['link', 'coupon', 'lifetime'] as const
const STATUSES = ['pending', 'approved', 'paid', 'reversed'] as const

/** The Commission page's `?source=&status=&from=&to=` as filters; anything unknown is dropped. */
export function commissionFilters(query: Record<string, string | string[] | undefined>) {
  const one = (k: string) => (typeof query[k] === 'string' ? (query[k] as string) : undefined)
  const source = SOURCES.find((s) => s === one('source'))
  const status = STATUSES.find((s) => s === one('status'))
  const date = (v: string | undefined) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : undefined)
  return { source, status, from: date(one('from')), to: date(one('to')) }
}

export type ActivityTotals = {
  referrals: number
  salesPaise: number
  commissionPaise: number
  clicks: number
}

/** A chart's points added up. */
export function totalsOf(points: ActivityPoint[]): ActivityTotals {
  return points.reduce(
    (t, p) => ({
      referrals: t.referrals + p.referrals,
      salesPaise: t.salesPaise + p.salesPaise,
      commissionPaise: t.commissionPaise + p.commissionPaise,
      clicks: t.clicks + p.clicks,
    }),
    { referrals: 0, salesPaise: 0, commissionPaise: 0, clicks: 0 },
  )
}

/** The same number of days just before a range (`30d` → the 30 days before those), or null for `all`. */
export function previousRange(
  range: PortalRange,
  now = new Date(),
): { from: string; to: string } | null {
  if (range === 'all') return null
  const days = Number.parseInt(range, 10)
  return {
    from: indiaToday(new Date(now.getTime() - (2 * days - 1) * DAY_MS)),
    to: indiaToday(new Date(now.getTime() - days * DAY_MS)),
  }
}

/** Their totals over the period before the range, for the cards' trend badges. */
export async function loadPreviousTotals(
  storeId: string,
  affiliateId: string,
  range: PortalRange,
): Promise<ActivityTotals | null> {
  const prev = previousRange(range)
  if (!prev) return null
  const { points } = await inStore(storeId, (tx) => portalActivity(tx, affiliateId, prev))
  return totalsOf(points)
}
