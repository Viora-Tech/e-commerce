/** SOURCE OF TRUTH: affiliate commission hold — WHAT: when a pending commission may be approved, and which order events reverse it / WHY: COD and RTO mean a sale only counts once it is delivered and kept */
import type { CommissionStatus } from './settings'

const DAY_MS = 86_400_000

/**
 * Pure. A commission is created `pending` when the order is paid (or delivered, for cash on
 * delivery). Delivery starts the hold: `holdDays` later, if nothing reversed it, it becomes
 * `approved`. Cancel, RTO and a full refund reverse it; a partial refund shrinks it.
 */
export function eligibleAt(deliveredAt: Date, holdDays: number): Date {
  return new Date(deliveredAt.getTime() + holdDays * DAY_MS)
}

/** Ready to approve: still pending, delivered, the hold over, and not held for review. */
export function isDue(
  c: { status: CommissionStatus; eligibleAt: Date | null; flag: string | null },
  now: Date,
): boolean {
  return c.status === 'pending' && c.eligibleAt !== null && c.eligibleAt <= now && !c.flag
}

export type ReverseReason = 'cancelled' | 'rto' | 'refunded' | 'self_referral' | 'manual'

/**
 * Whether an order event may still change this commission. Paid money is not clawed back
 * automatically (the merchant settles it with the affiliate); a reversed one stays reversed.
 */
export function canReverse(status: CommissionStatus): boolean {
  return status === 'pending' || status === 'approved'
}

/**
 * Whether a click (the touch time on the order's attribution) is recent enough for an order
 * placed at `placedAt` to earn on it.
 */
export function withinCookieWindow(touchedAt: Date, placedAt: Date, cookieDays: number): boolean {
  const age = placedAt.getTime() - touchedAt.getTime()
  return age >= -60_000 && age <= cookieDays * DAY_MS
}

/** For `lifetime` programs: an order inside `lifetimeDays` of the customer's first referred order. */
export function withinLifetime(firstAt: Date, placedAt: Date, lifetimeDays: number): boolean {
  const age = placedAt.getTime() - firstAt.getTime()
  return age >= 0 && age <= lifetimeDays * DAY_MS
}
