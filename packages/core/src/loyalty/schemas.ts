/** SOURCE OF TRUTH: Loyalty v2 input shapes — WHAT: the zod schemas for earning rules (per type settings), rewards, VIP tiers and bonus campaigns, shared by the API, the admin forms and core / WHY: one shape per thing, browser-safe (`@commerce/core/loyalty`), so a form and the server refuse the same input */
import { z } from 'zod'

export const LOYALTY_RULE_TYPES = [
  'order_spend',
  'first_order',
  'signup',
  'newsletter',
  'birthday',
  'anniversary',
  'daily_visit',
  'visit_streak',
  'product_review',
  'google_review',
  'social',
] as const
export type LoyaltyRuleType = (typeof LOYALTY_RULE_TYPES)[number]

/** Social and link actions; a `social` rule's `key`. */
export const LOYALTY_SOCIAL_KINDS = [
  'instagram',
  'youtube',
  'x',
  'facebook',
  'tiktok',
  'pinterest',
  'discord',
  'reddit',
  'telegram',
  'whatsapp',
  'link',
] as const

export const LOYALTY_REWARD_TYPES = [
  'amount_off',
  'custom_amount_off',
  'percent_off',
  'free_product',
  'free_shipping',
  'store_credit',
] as const
export type LoyaltyRewardType = (typeof LOYALTY_REWARD_TYPES)[number]

/** Rules a shopper earns once, ever (the rest repeat: orders, visits, streaks, birthdays...). */
export const ONCE_ONLY_RULES: readonly LoyaltyRuleType[] = [
  'first_order',
  'signup',
  'newsletter',
  'google_review',
  'social',
]

const url = z.url().max(500)

/** Each rule type's own settings. */
export const RULE_SETTINGS = {
  order_spend: z.object({
    /** Lines whose product carries one of these tags earn nothing. */
    excludeProductTags: z.array(z.string().trim().min(1).max(60)).max(50).default([]),
  }),
  first_order: z.object({}),
  signup: z.object({}),
  newsletter: z.object({}),
  birthday: z.object({}),
  anniversary: z.object({}),
  daily_visit: z.object({}),
  visit_streak: z.object({
    /** Days in a row for the bonus; given again every further `days`. */
    days: z.number().int().min(2).max(365).default(7),
  }),
  product_review: z.object({}),
  google_review: z.object({ url }),
  social: z.object({
    url,
    /** What the button asks: follow, join, subscribe, visit. */
    action: z.enum(['follow', 'join', 'subscribe', 'visit']).default('follow'),
  }),
} satisfies Record<LoyaltyRuleType, z.ZodType>

export type RuleSettings<T extends LoyaltyRuleType> = z.infer<(typeof RULE_SETTINGS)[T]>

/** A rule's settings parsed for its type; the type's defaults when missing or invalid. */
export function parseRuleSettings<T extends LoyaltyRuleType>(
  type: T,
  raw: unknown,
): RuleSettings<T> {
  const schema = RULE_SETTINGS[type] as unknown as z.ZodType<RuleSettings<T>>
  const r = schema.safeParse(raw ?? {})
  if (r.success) return r.data
  // A rule whose settings need a link (social, Google review) has no default: keep it empty.
  const empty = schema.safeParse({})
  return (empty.success ? empty.data : { url: '' }) as RuleSettings<T>
}

export const EarnRuleInputSchema = z
  .object({
    type: z.enum(LOYALTY_RULE_TYPES),
    /** A `social` rule's platform (`instagram`...); '' for the other types. */
    key: z.string().trim().max(40).default(''),
    title: z.string().trim().max(120).nullable().default(null),
    /** Points given; for `order_spend`, points per ₹100 spent. */
    points: z.number().int().min(0).max(1_000_000),
    settings: z.record(z.string(), z.unknown()).default({}),
    enabled: z.boolean().default(true),
    position: z.number().int().min(0).max(10_000).default(0),
  })
  .superRefine((r, ctx) => {
    if (r.type === 'social' && !(LOYALTY_SOCIAL_KINDS as readonly string[]).includes(r.key)) {
      ctx.addIssue({ code: 'custom', path: ['key'], message: 'Pick a platform' })
    }
    if (r.type !== 'social' && r.key !== '') {
      ctx.addIssue({ code: 'custom', path: ['key'], message: 'Only social rules have a key' })
    }
    if (r.type === 'order_spend' && r.points > 100) {
      ctx.addIssue({ code: 'custom', path: ['points'], message: 'At most 100 points per ₹100' })
    }
    const settings = RULE_SETTINGS[r.type].safeParse(r.settings)
    if (!settings.success) {
      ctx.addIssue({
        code: 'custom',
        path: ['settings'],
        message: settings.error.issues[0]?.message ?? 'Check the settings',
      })
    }
  })
export type EarnRuleInput = z.input<typeof EarnRuleInputSchema>

export const RewardInputSchema = z
  .object({
    type: z.enum(LOYALTY_REWARD_TYPES),
    title: z.string().trim().min(1).max(120),
    description: z.string().trim().max(500).nullable().default(null),
    /** Points it costs; for `custom_amount_off`, points per step. 0 only for a tier's free reward. */
    pointsCost: z.number().int().min(0).max(10_000_000),
    /** Paise off (`amount_off`, per step for `custom_amount_off`), basis points (`percent_off`), store credit paise. */
    value: z.number().int().min(0).max(100_000_000).default(0),
    minPoints: z.number().int().min(1).max(10_000_000).nullable().default(null),
    maxPoints: z.number().int().min(1).max(10_000_000).nullable().default(null),
    productId: z.uuid().nullable().default(null),
    variantId: z.uuid().nullable().default(null),
    minOrderPaise: z.number().int().min(0).max(100_000_000).nullable().default(null),
    minTierId: z.uuid().nullable().default(null),
    usageLimit: z.number().int().min(1).max(10_000_000).nullable().default(null),
    oncePerCustomer: z.boolean().default(false),
    codeDays: z.number().int().min(1).max(3650).nullable().default(90),
    active: z.boolean().default(true),
    position: z.number().int().min(0).max(10_000).default(0),
  })
  .superRefine((r, ctx) => {
    const need = (ok: boolean, path: string, message: string) => {
      if (!ok) ctx.addIssue({ code: 'custom', path: [path], message })
    }
    if (r.type === 'amount_off' || r.type === 'custom_amount_off' || r.type === 'store_credit') {
      need(r.value > 0, 'value', 'Enter an amount')
    }
    if (r.type === 'percent_off')
      need(r.value >= 1 && r.value <= 10_000, 'value', 'Percent must be between 0.01 and 100')
    if (r.type === 'free_product') need(Boolean(r.productId), 'productId', 'Pick a product')
    if (r.type === 'custom_amount_off') {
      need(r.pointsCost > 0, 'pointsCost', 'Enter the points per step')
      need(
        r.minPoints === null || r.maxPoints === null || r.minPoints <= r.maxPoints,
        'maxPoints',
        'The most must be at least the fewest',
      )
    }
  })
export type RewardInput = z.input<typeof RewardInputSchema>

const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'A colour like #1f2937')

export const TierInputSchema = z.object({
  name: z.string().trim().min(1).max(60),
  /** Points earned, or paise spent, per the store's tier basis. */
  threshold: z.number().int().min(0).max(2_000_000_000),
  /** Earning multiplier on order points, basis points (12500 = 1.25x). */
  multiplierBp: z.number().int().min(0).max(100_000).default(10_000),
  perks: z.array(z.string().trim().min(1).max(200)).max(20).default([]),
  rewardId: z.uuid().nullable().default(null),
  customerTag: z.string().trim().min(1).max(60).nullable().default(null),
  colors: z.object({ background: hex, text: hex }).nullable().default(null),
  position: z.number().int().min(0).max(1_000).default(0),
})
export type TierInput = z.input<typeof TierInputSchema>

export const LoyaltyCampaignInputSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    startsAt: z.coerce.date(),
    endsAt: z.coerce.date(),
    tierIds: z.array(z.uuid()).max(50).default([]),
    bonusType: z.enum(['multiplier', 'fixed']),
    /** For `multiplier`: 20000 = 2x. */
    multiplierBp: z.number().int().min(10_000).max(100_000).default(10_000),
    /** For `fixed`: points added to each order. */
    bonusPoints: z.number().int().min(0).max(1_000_000).default(0),
    active: z.boolean().default(true),
  })
  .refine((c) => c.endsAt.getTime() > c.startsAt.getTime(), {
    message: 'The end must be after the start',
    path: ['endsAt'],
  })
export type LoyaltyCampaignInput = z.input<typeof LoyaltyCampaignInputSchema>

/** A redemption's life: code not used yet, used by an order, cancelled by staff, ran out. */
export const LOYALTY_REDEMPTION_STATUSES = ['issued', 'used', 'cancelled', 'expired'] as const

/** A referral's life: friend joined, friend's order waiting out the hold, rewarded, refused. */
export const LOYALTY_REFERRAL_STATUSES = [
  'pending',
  'friend_ordered',
  'completed',
  'rejected',
] as const
