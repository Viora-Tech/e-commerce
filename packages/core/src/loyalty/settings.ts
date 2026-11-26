/** SOURCE OF TRUTH: Loyalty points app settings and rules — WHAT: the app id, the merchant's numbers (earn rate, expiry, review and birthday points, reminder) kept in `store.apps.settings.loyalty` with no table, and the pure rules (points for an amount, expiry date, birthday match) / WHY: the hooks, the worker's sweep, the admin pages and the storefront must agree, and client code needs it without a database import (`@commerce/core/loyalty`) */
import { z } from 'zod'

export const LOYALTY_APP_ID = 'loyalty'

/** One point is worth ₹1 of store credit. */
export const POINT_PAISE = 100

/** Points come per this much spent (₹100). */
const EARN_PER_PAISE = 10_000

/** A review earns points only when it was published this recently (the sweep looks back this far). */
export const REVIEW_LOOKBACK_DAYS = 7

/**
 * A referral reward: `points`, `percent` (whole percent off the order, 1 to 90) or `fixed`
 * (paise off the order).
 */
export const ReferralRewardSchema = z
  .object({
    kind: z.enum(['points', 'percent', 'fixed']),
    value: z.number().int().min(1).max(10_000_000),
  })
  .refine((r) => r.kind !== 'percent' || r.value <= 90, {
    message: 'A percent off is 1 to 90',
    path: ['value'],
  })
export type ReferralReward = z.infer<typeof ReferralRewardSchema>

/** Where a member can share their referral link from the storefront. */
export const REFERRAL_SHARE_CHANNELS = [
  'whatsapp',
  'email',
  'x',
  'facebook',
  'messenger',
  'threads',
  'telegram',
] as const
export type ReferralShareChannel = (typeof REFERRAL_SHARE_CHANNELS)[number]

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
  /**
   * v1: days before points run out that the reminder email goes; 0 sends none. In v2 the
   * reminders go 30 and 7 days before (`POINTS_EXPIRY_NOTICE_DAYS`); 0 still turns them off.
   */
  reminderDays: z.number().int().min(0).max(60).default(14),
  // v2 (24 Nov 2026). Each field has its own default, so a v1 row parses to today's behaviour.
  /** Points sit on the store credit balance and pay at checkout; off: only rewards spend them. */
  pointsAsStoreCredit: z.boolean().default(true),
  /** What the store calls its points, in the shopper's words. */
  pointsNameSingular: z.string().trim().min(1).max(30).default('point'),
  pointsNamePlural: z.string().trim().min(1).max(30).default('points'),
  /** Customers with any of these tags never earn or redeem. */
  excludeTags: z.array(z.string().trim().min(1).max(60)).max(50).default([]),
  /** `paused`: only the test accounts below see and use the program. */
  programStatus: z.enum(['live', 'paused']).default('live'),
  /** Emails that use the program while it is paused (lower-cased). */
  testEmails: z.array(z.string().trim().toLowerCase().max(200)).max(50).default([]),
  /** Order points count the shipping charge too. */
  includeShipping: z.boolean().default(false),
  /** Order points count GST (Indian prices include it, so on is the v1 behaviour). */
  includeTaxes: z.boolean().default(true),
  /** VIP tiers go by points earned or by money spent. */
  tierBasis: z.enum(['points', 'spend']).default('points'),
  /** Over the whole membership, or the last 12 months. */
  tierWindow: z.enum(['lifetime', 'rolling_12m']).default('lifetime'),
  /** Loyalty emails the merchant switched off on the app's Emails page (`LOYALTY_EMAIL_KEYS`). */
  emailsOff: z.array(z.string().min(1).max(60)).max(20).default([]),
  /**
   * Storefront pages the program adds (Placements → Embedded content and Customer accounts):
   * the rewards landing page at `/pages/rewards`, the Points section in the customer account,
   * and the points card at the top of the account's Orders page.
   */
  pages: z
    .object({
      landing: z.boolean().default(true),
      account: z.boolean().default(true),
      accountStatus: z.boolean().default(true),
    })
    .default({ landing: true, account: true, accountStatus: true }),
  referrals: z
    .object({
      enabled: z.boolean().default(false),
      referrerReward: ReferralRewardSchema.default({ kind: 'points', value: 100 }),
      friendReward: ReferralRewardSchema.default({ kind: 'percent', value: 10 }),
      /** Most friends one member may refer; 0 no limit. */
      maxPerMember: z.number().int().min(0).max(10_000).default(0),
      /** Tags added to the referrer and the friend, and to the friend's first order; '' none. */
      referrerTag: z.string().trim().max(60).default(''),
      friendTag: z.string().trim().max(60).default(''),
      orderTag: z.string().trim().max(60).default(''),
      /** Days a referral discount code works. */
      codeDays: z.number().int().min(1).max(365).default(30),
      /** Reward only once the friend's order is past the return window (off: on delivery). */
      holdForReturns: z.boolean().default(true),
      /** Share buttons the storefront shows beside the referral link. */
      shareChannels: z
        .array(z.enum(REFERRAL_SHARE_CHANNELS))
        .max(REFERRAL_SHARE_CHANNELS.length)
        .default(['whatsapp', 'email', 'x', 'facebook']),
    })
    .default({
      enabled: false,
      referrerReward: { kind: 'points', value: 100 },
      friendReward: { kind: 'percent', value: 10 },
      maxPerMember: 0,
      referrerTag: '',
      friendTag: '',
      orderTag: '',
      codeDays: 30,
      holdForReturns: true,
      shareChannels: ['whatsapp', 'email', 'x', 'facebook'],
    }),
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

/** Days before points run out that the reminder emails go (v2). */
export const POINTS_EXPIRY_NOTICE_DAYS = [30, 7] as const

/** Days before an issued reward code runs out that the reminder emails go. */
export const REWARD_EXPIRY_NOTICE_DAYS = [30, 3] as const

/** "1 point", "250 points", in the store's own name for points. */
export function pointsLabel(
  n: number,
  s: Pick<LoyaltySettings, 'pointsNameSingular' | 'pointsNamePlural'>,
): string {
  return `${n} ${Math.abs(n) === 1 ? s.pointsNameSingular : s.pointsNamePlural}`
}

/**
 * Whether a customer is in the program: not carrying an excluded tag, and, while the program
 * is paused, one of the test accounts.
 */
export function programOpenTo(
  s: Pick<LoyaltySettings, 'excludeTags' | 'programStatus' | 'testEmails'>,
  c: { email: string | null; tags: readonly string[] },
): boolean {
  const excluded = new Set(s.excludeTags.map((t) => t.toLowerCase()))
  if (c.tags.some((t) => excluded.has(t.toLowerCase()))) return false
  if (s.programStatus === 'paused') {
    const email = (c.email ?? '').trim().toLowerCase()
    return email !== '' && s.testEmails.includes(email)
  }
  return true
}

/** Order points after a tier or campaign multiplier (basis points) and a fixed bonus. */
export function boostedPoints(
  basePoints: number,
  multiplierBp: number,
  bonusPoints: number,
): number {
  if (basePoints <= 0) return 0
  return Math.floor((basePoints * Math.max(0, multiplierBp)) / 10_000) + Math.max(0, bonusPoints)
}

/**
 * The loyalty emails a merchant can switch on or off, one per template and reminder day
 * (Emails page). `points_expiring` also stays off while `reminderDays` is 0.
 */
export const LOYALTY_EMAIL_KEYS = [
  'loyalty_points_earned',
  'loyalty_reward_redeemed',
  'loyalty_reward_expiring:30',
  'loyalty_reward_expiring:3',
  'loyalty_birthday',
  'loyalty_tier_unlocked',
  'points_expiring:30',
  'points_expiring:7',
] as const
export type LoyaltyEmailKey = (typeof LOYALTY_EMAIL_KEYS)[number]

/** A queued email's switch: the template, plus the reminder day for the two expiry emails. */
export function loyaltyEmailKey(template: string, data: unknown): string {
  const days = (data as { days?: unknown } | null)?.days
  const daily = template === 'loyalty_reward_expiring' || template === 'points_expiring'
  return daily && typeof days === 'number' ? `${template}:${days}` : template
}

/** Whether the store sends this loyalty email (everything is on until switched off). */
export function loyaltyEmailOn(
  s: Pick<LoyaltySettings, 'emailsOff' | 'reminderDays'>,
  key: string,
): boolean {
  if (key.startsWith('points_expiring') && s.reminderDays === 0) return false
  return !s.emailsOff.includes(key)
}
