/** SOURCE OF TRUTH: Loyalty points app settings and rules — WHAT: the app id, the merchant's numbers (earn rate, expiry, review and birthday points, reminder) kept in `store.apps.settings.loyalty` with no table, and the pure rules (points for an amount, expiry date, birthday match) / WHY: the hooks, the worker's sweep, the admin pages and the storefront must agree, and client code needs it without a database import (`@commerce/core/loyalty`) */
import { z } from 'zod'

export const LOYALTY_APP_ID = 'loyalty'

/** One point is worth ₹1 of store credit. */
export const POINT_PAISE = 100

/** Points come per this much spent (₹100). */
const EARN_PER_PAISE = 10_000

/** A review earns points only when it was published this recently (the sweep looks back this far). */
export const REVIEW_LOOKBACK_DAYS = 7

/** Owner's defaults (16 Nov 2026); every number is the merchant's to change. */
export const LoyaltySettingsSchema = z.object({
  /** Points per ₹100 spent (1 = 1%); 0 turns earning on orders off. */
  pointsPer100: z.number().int().min(0).max(100).default(1),
  /** Months after earning that points run out; 0 never. */
  expiryMonths: z.number().int().min(0).max(60).default(12),
  /** Points for a review of a delivered product, once per product; 0 off. */
  reviewPoints: z.number().int().min(0).max(10_000).default(25),
  /** Points on the shopper's birthday, once a year; 0 off. */
  birthdayPoints: z.number().int().min(0).max(10_000).default(100),
  /** Days before points run out that the reminder email goes; 0 sends none. */
  reminderDays: z.number().int().min(0).max(60).default(14),
})
export type LoyaltySettings = z.infer<typeof LoyaltySettingsSchema>
export type LoyaltySettingsInput = z.input<typeof LoyaltySettingsSchema>

export const defaultLoyaltySettings: LoyaltySettings = LoyaltySettingsSchema.parse({})

/** The app's entry in `store.apps.settings`, falling back to the defaults when missing or invalid. */
export function parseLoyaltySettings(raw: unknown): LoyaltySettings {
  const r = LoyaltySettingsSchema.safeParse(raw ?? {})
  return r.success ? r.data : defaultLoyaltySettings
}

/** Whole points for a spend in paise: `floor(spend × rate / ₹100)`, never below 0. */
export function pointsForPaise(paise: number, pointsPer100: number): number {
  if (paise <= 0 || pointsPer100 <= 0) return 0
  return Math.floor((paise * pointsPer100) / EARN_PER_PAISE)
}

/** When points earned at `from` run out (`months` later, the same moment); null when they never do. */
export function pointsExpiryAt(from: Date, months: number): Date | null {
  if (months <= 0) return null
  const d = new Date(from.getTime())
  const day = d.getUTCDate()
  d.setUTCDate(1)
  d.setUTCMonth(d.getUTCMonth() + months)
  // 31 Jan + 1 month is the last day of February, not 3 March.
  const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate()
  d.setUTCDate(Math.min(day, last))
  return d
}

/** A birthday as stored: `MM-DD` (no year). */
const BIRTHDAY = /^(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$/

const DAYS_IN_MONTH = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]

/** `MM-DD` for a real day of the year (29 Feb allowed), else null. Accepts `YYYY-MM-DD` too. */
export function normaliseBirthday(raw: string | null | undefined): string | null {
  const v = (raw ?? '').trim()
  const mmdd = /^\d{4}-\d{2}-\d{2}$/.test(v) ? v.slice(5) : v
  if (!BIRTHDAY.test(mmdd)) return null
  const [m, d] = mmdd.split('-').map(Number) as [number, number]
  return d <= (DAYS_IN_MONTH[m - 1] ?? 0) ? mmdd : null
}

const isLeapYear = (y: number) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0

/**
 * The birthdays (`MM-DD`) celebrated on `today` (`YYYY-MM-DD`, store time): that day, and 29 Feb
 * on 28 Feb in a year without one.
 */
export function birthdaysOn(today: string): string[] {
  const year = Number(today.slice(0, 4))
  const mmdd = today.slice(5)
  return mmdd === '02-28' && !isLeapYear(year) ? ['02-28', '02-29'] : [mmdd]
}
