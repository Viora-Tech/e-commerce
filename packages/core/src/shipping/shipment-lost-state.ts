/** SOURCE OF TRUTH: STUCK_DAYS, daysWithoutScan, isStuck, lostActions, claimEstimatePaise — WHAT: when a parcel on its way has gone quiet long enough to check with the courier, what can be done with a lost parcel, and what the courier should pay for it / WHY: the admin's Shipments list, its row menu and the server agree on the same rules (owner, 18 Nov 2026)
 *
 * Pure, no database: the admin imports it from `@commerce/core/shipment-lost-state`.
 */
import { type CourierCover, courierCover, DEFAULT_PROTECT_CARD } from './delivery-options/protect'

/** A parcel on its way with no new courier scan for this many days is "Check with courier". */
export const STUCK_DAYS = 7

/** Statuses where the courier has the parcel. */
export const MOVING_STATUSES: ReadonlySet<string> = new Set([
  'picked_up',
  'in_transit',
  'out_for_delivery',
])

/** The courier claim's states for a lost parcel. */
export const CLAIM_STATUSES = ['not_filed', 'filed', 'paid', 'rejected'] as const
export type ClaimStatus = (typeof CLAIM_STATUSES)[number]

const DAY_MS = 86_400_000

/** The latest scan time in a stored tracking answer, or null when it has none. */
export function lastScanAt(tracking: unknown): Date | null {
  const events = (tracking as { events?: Array<{ at?: string }> } | null)?.events
  if (!Array.isArray(events)) return null
  let latest: number | null = null
  for (const e of events) {
    const t = e?.at ? Date.parse(e.at) : Number.NaN
    if (!Number.isNaN(t) && (latest === null || t > latest)) latest = t
  }
  return latest === null ? null : new Date(latest)
}

/**
 * Whole days since the courier last scanned a parcel on its way (from its pickup, booking time
 * when no scan has a time). Null for a parcel not with the courier.
 */
export function daysWithoutScan(
  s: { status: string; tracking: unknown; createdAt: Date | string },
  now: Date = new Date(),
): number | null {
  if (!MOVING_STATUSES.has(s.status)) return null
  const since = lastScanAt(s.tracking) ?? new Date(s.createdAt)
  return Math.max(0, Math.floor((now.getTime() - since.getTime()) / DAY_MS))
}

/** True when a parcel on its way has gone `STUCK_DAYS` without a scan. */
export const isStuck = (
  s: { status: string; tracking: unknown; createdAt: Date | string },
  now: Date = new Date(),
): boolean => (daysWithoutScan(s, now) ?? 0) >= STUCK_DAYS

/** What the row menu offers for a parcel, lost-wise. */
export function lostActions(s: { status: string; reshippedAt: Date | string | null }): {
  markLost: boolean
  reship: boolean
  claim: boolean
} {
  const lost = s.status === 'lost'
  return {
    markLost: MOVING_STATUSES.has(s.status),
    reship: lost && s.reshippedAt === null,
    claim: lost,
  }
}

/**
 * What the courier should pay for a lost parcel worth `valuePaise`: insured, the value up to the
 * cover cap less the excess; not insured, the value up to its uninsured limit. Null when the
 * courier's terms are not known (the merchant types the amount).
 */
export function claimEstimatePaise(
  providerId: string,
  valuePaise: number | null,
  insured: boolean,
  cover: CourierCover = courierCover(providerId, DEFAULT_PROTECT_CARD),
): number | null {
  if (valuePaise === null || valuePaise <= 0) return null
  if (insured) {
    if (cover.coverCapPaise === null) return valuePaise
    const capped = Math.min(valuePaise, cover.coverCapPaise)
    return capped - Math.round((capped * (cover.deductibleBps ?? 0)) / 10_000)
  }
  return cover.uninsuredLimitPaise === null ? null : Math.min(valuePaise, cover.uninsuredLimitPaise)
}
