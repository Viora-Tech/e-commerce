/** SOURCE OF TRUTH: affiliate program settings — WHAT: commission rules, windows, approval, payouts and TDS for one store / WHY: one schema for the admin form, the API, the storefront and the worker */
import { z } from 'zod'

/**
 * The Affiliates app's program, kept in `store.apps.settings.affiliates` (no table: one
 * program per store). Pure and client-safe, so the admin form imports it directly.
 *
 * Money is paise, percentages are basis points (100 = 1%).
 */

export const AFFILIATES_ID = 'affiliates'

/** Percent of the line's net sale, or a flat amount (per order for the default rule, per unit for an override). */
export const CommissionRuleSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('percent'), bp: z.number().int().min(0).max(10_000) }),
  z.object({ type: z.literal('flat'), paise: z.number().int().min(0).max(10_000_000) }),
])
export type CommissionRule = z.infer<typeof CommissionRuleSchema>

/** A different rule for one product or one collection's products. Products win over collections. */
export const CommissionOverrideSchema = z.object({
  target: z.enum(['product', 'collection']),
  id: z.uuid(),
  /** Shown in the admin list; the id is what counts. */
  label: z.string().max(200).default(''),
  rule: CommissionRuleSchema,
})
export type CommissionOverride = z.infer<typeof CommissionOverrideSchema>

/** A tier lifts an affiliate's default percent once their approved sales pass a mark. */
export const TierSchema = z.object({
  name: z.string().trim().min(1).max(40),
  /** Approved (and paid) net sales, all time. */
  minSalesPaise: z.number().int().min(0).max(1_000_000_000_00),
  bp: z.number().int().min(0).max(10_000),
})
export type Tier = z.infer<typeof TierSchema>

export const AffiliateSettingsSchema = z.object({
  /** Off pauses new signups and new commissions; links keep working, earned money stays. */
  active: z.boolean().default(true),
  commission: CommissionRuleSchema.default({ type: 'percent', bp: 1000 }),
  overrides: z.array(CommissionOverrideSchema).max(200).default([]),
  /** `first_order`: only a customer's first order earns. `lifetime`: every order within `lifetimeDays` of the first. */
  scope: z.enum(['first_order', 'lifetime']).default('first_order'),
  lifetimeDays: z.number().int().min(1).max(3650).default(365),
  /** How long after clicking a link an order still counts. The storefront cookie lasts 30 days at most. */
  cookieDays: z.number().int().min(1).max(30).default(30),
  /** `auto` approves every signup; `manual` waits for the merchant. */
  approval: z.enum(['auto', 'manual']).default('manual'),
  /** Days after delivery before a commission can be paid (the return window). */
  holdDays: z.number().int().min(0).max(90).default(7),
  minPayoutPaise: z.number().int().min(0).max(10_000_000).default(500_00),
  /** A personal code each approved affiliate gets, made in the discount engine. */
  coupon: z
    .object({
      enabled: z.boolean().default(true),
      /** What the shopper saves with the code. */
      bp: z.number().int().min(1).max(10_000).default(1000),
    })
    .default({ enabled: true, bp: 1000 }),
  /**
   * TDS on commission (section 194H, from 1 April 2026 section 393 of the Income-tax Act,
   * 2025): deducted when a commission is approved (credited), once an affiliate's commission
   * in the financial year passes the threshold. Higher rate without a PAN (section 206AA).
   */
  tds: z
    .object({
      enabled: z.boolean().default(true),
      bp: z.number().int().min(0).max(10_000).default(200),
      noPanBp: z.number().int().min(0).max(10_000).default(2000),
      thresholdPaise: z.number().int().min(0).max(1_000_000_00).default(20_000_00),
    })
    .default({ enabled: true, bp: 200, noPanBp: 2000, thresholdPaise: 20_000_00 }),
  tiers: z.array(TierSchema).max(10).default([]),
  /** Shown on the storefront signup page above the form. */
  pitch: z.string().max(2000).default(''),
  /** Program terms the affiliate accepts when applying. */
  terms: z.string().max(10_000).default(''),
})
export type AffiliateSettings = z.infer<typeof AffiliateSettingsSchema>

export const defaultAffiliateSettings: AffiliateSettings = AffiliateSettingsSchema.parse({})

/** A stored entry, or the defaults when it is missing or unreadable. */
export function parseAffiliateSettings(raw: unknown): AffiliateSettings {
  const r = AffiliateSettingsSchema.safeParse(raw ?? {})
  return r.success ? r.data : defaultAffiliateSettings
}

/** `?ref=` value as typed in a link, or null when it cannot be one of ours (core owns the rule). */
export { refCodeOf as normaliseRefCode } from '@commerce/core/marketing'

export const AFFILIATE_STATUSES = ['pending', 'approved', 'rejected', 'suspended'] as const
export type AffiliateStatus = (typeof AFFILIATE_STATUSES)[number]

/**
 * `pending`: waiting for delivery and the return window. `approved`: earned, waiting for a
 * payout. `paid`: in a payout marked paid. `reversed`: cancelled, returned (RTO), refunded or
 * refused by a fraud check; never paid.
 */
export const COMMISSION_STATUSES = ['pending', 'approved', 'paid', 'reversed'] as const
export type CommissionStatus = (typeof COMMISSION_STATUSES)[number]

export const PAYOUT_STATUSES = ['pending', 'paid'] as const
export type PayoutStatus = (typeof PAYOUT_STATUSES)[number]
