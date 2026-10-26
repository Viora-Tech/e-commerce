/** SOURCE OF TRUTH: affiliate settings — WHAT: the store-wide settings, one program's rules, and the two merged / WHY: one schema for the admin forms, the API, the storefront and the worker */
import { z } from 'zod'
import { DEFAULT_COUPON_SITES } from './fraud'

/**
 * Two levels, both pure and client-safe so the admin forms import them directly:
 *
 * - Store-wide settings (`StoreAffiliateSettingsSchema`), kept in `store.apps.settings.affiliates`:
 *   open or paused, the link window, the hold, the minimum payout and TDS. Tracking, returns and
 *   tax facts, the same for every program.
 * - A program's rules (`ProgramRulesSchema`), kept in `affiliate_program.rules`: what an
 *   affiliate earns and on which orders, approval, their code, tiers and the signup page. A store
 *   has one default program and may add more.
 *
 * `AffiliateSettings` is the two merged: what one affiliate's order is worked out with. Before
 * programs it was the whole store entry, and v1 entries still hold the program keys (migration
 * 0163 copied them into the default program; they are left in the store entry, unread).
 *
 * Money is paise, percentages are basis points (100 = 1%).
 */

export const AFFILIATES_ID = 'affiliates'

/** Default section label on the 26Q export: the Income-tax Act, 2025 entry and the old 194H. */
export const TDS_SECTION = '393(1) Sl. 1(ii) / 194H'

/** Share and earn: off, or an invite the buyer accepts with one tap. */
export const AUTO_ENROL_MODES = ['off', 'invite'] as const

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

/** A product, or a collection's products, that earns no commission at all. */
export const CommissionExcludeSchema = z.object({
  target: z.enum(['product', 'collection']),
  id: z.uuid(),
  label: z.string().max(200).default(''),
})
export type CommissionExclude = z.infer<typeof CommissionExcludeSchema>

/**
 * A different default rule once an order's goods pass a value (after discount, GST included,
 * without shipping: the "₹2,000 order" a merchant thinks in). The highest level passed wins.
 */
export const CommissionLevelSchema = z.object({
  minOrderPaise: z.number().int().min(0).max(1_000_000_000_00),
  rule: CommissionRuleSchema,
})
export type CommissionLevel = z.infer<typeof CommissionLevelSchema>

/** A tier lifts an affiliate's default percent once their approved sales pass a mark. */
export const TierSchema = z.object({
  name: z.string().trim().min(1).max(40),
  /** Approved (and paid) net sales, all time. */
  minSalesPaise: z.number().int().min(0).max(1_000_000_000_00),
  bp: z.number().int().min(0).max(10_000),
})
export type Tier = z.infer<typeof TierSchema>

/** The store-wide part, in `store.apps.settings.affiliates`. */
export const StoreAffiliateSettingsSchema = z.object({
  /** Off pauses new signups and new commissions; links keep working, earned money stays. */
  active: z.boolean().default(true),
  /** How long after clicking a link an order still counts. The storefront cookie lasts 30 days at most. */
  cookieDays: z.number().int().min(1).max(30).default(30),
  /** Days after delivery before a commission can be paid (the return window). */
  holdDays: z.number().int().min(0).max(90).default(7),
  minPayoutPaise: z.number().int().min(0).max(10_000_000).default(500_00),
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
      /** The section printed on the quarterly TDS report (26Q). CA check. */
      section: z.string().trim().max(80).default(TDS_SECTION),
    })
    .default({
      enabled: true,
      bp: 200,
      noPanBp: 2000,
      thresholdPaise: 20_000_00,
      section: TDS_SECTION,
    }),
  /**
   * GST on commission for GST-registered affiliates (they gave a GSTIN): added on top of the
   * payout, since they invoice it and the store claims the input tax credit. 18% by default.
   * Research note, not tax advice: the merchant's CA should confirm.
   */
  gst: z
    .object({
      enabled: z.boolean().default(true),
      bp: z.number().int().min(0).max(10_000).default(1800),
    })
    .default({ enabled: true, bp: 1800 }),
  /** Hold payouts of an affiliate with no PAN once their commission this year passes the TDS threshold. */
  requirePanAboveThreshold: z.boolean().default(false),
  /**
   * Share and earn: after an order, the thank-you page and order emails invite the buyer to
   * become an affiliate in one tap. Invite only, never automatic (consent).
   */
  autoEnrol: z
    .object({
      mode: z.enum(AUTO_ENROL_MODES).default('off'),
      /** The program they join; null is the store's default program. */
      programId: z.uuid().nullable().default(null),
      /** Orders below this value get no invite. */
      minOrderPaise: z.number().int().min(0).max(10_000_000).default(0),
    })
    .default({ mode: 'off', programId: null, minOrderPaise: 0 }),
  /**
   * Checks that hold a commission for review: a code used from a coupon site (needs the
   * shopper's analytics consent for the referrer) and a coupon spike.
   */
  fraud: z
    .object({
      couponSites: z
        .array(z.string().trim().toLowerCase().min(3).max(100))
        .max(100)
        .default([...DEFAULT_COUPON_SITES]),
      spikeMultiple: z.number().int().min(2).max(20).default(3),
    })
    .default({ couponSites: [...DEFAULT_COUPON_SITES], spikeMultiple: 3 }),
})
export type StoreAffiliateSettings = z.infer<typeof StoreAffiliateSettingsSchema>

/** Field kinds a program's signup form can ask. */
export const SIGNUP_FIELD_KINDS = [
  'text',
  'textarea',
  'url',
  'number',
  'select',
  'checkbox',
] as const
export type SignupFieldKind = (typeof SIGNUP_FIELD_KINDS)[number]

/** One extra question on a program's signup page. */
export const SignupFieldSchema = z.object({
  id: z.string().regex(/^[a-z0-9_]{1,32}$/),
  label: z.string().trim().min(1).max(120),
  kind: z.enum(SIGNUP_FIELD_KINDS).default('text'),
  required: z.boolean().default(false),
  /** For a select: the choices. */
  options: z.array(z.string().trim().min(1).max(80)).max(20).default([]),
})
export type SignupField = z.infer<typeof SignupFieldSchema>

/**
 * A shopper's answers kept to the form's fields: trimmed, at most 1,000 characters, a select
 * only one of its options, a checkbox `yes` or nothing. The first required field left empty is
 * returned as `missing`.
 */
export function cleanAnswers(
  form: readonly SignupField[],
  raw: Record<string, unknown>,
): { answers: Record<string, string>; missing: string | null } {
  const answers: Record<string, string> = {}
  let missing: string | null = null
  for (const f of form) {
    const v = raw[f.id]
    let value = typeof v === 'string' ? v.trim().slice(0, 1000) : v === true ? 'yes' : ''
    if (f.kind === 'select' && !f.options.includes(value)) value = ''
    if (f.kind === 'checkbox') value = value ? 'yes' : ''
    if (f.kind === 'number' && value && !/^-?\d+(\.\d+)?$/.test(value)) value = ''
    if (value) answers[f.id] = value
    else if (f.required && !missing) missing = f.id
  }
  return { answers, missing }
}

/** One program's rules, in `affiliate_program.rules`. */
export const ProgramRulesSchema = z.object({
  commission: CommissionRuleSchema.default({ type: 'percent', bp: 1000 }),
  overrides: z.array(CommissionOverrideSchema).max(200).default([]),
  /** Products and collections that earn nothing; their lines leave the base too. */
  excludes: z.array(CommissionExcludeSchema).max(200).default([]),
  /** Order-value levels for the default rule. */
  levels: z.array(CommissionLevelSchema).max(10).default([]),
  /** `first_order`: only a customer's first order earns. `lifetime`: every order within `lifetimeDays` of the first. */
  scope: z.enum(['first_order', 'lifetime']).default('first_order'),
  lifetimeDays: z.number().int().min(1).max(3650).default(365),
  /** `auto` approves every signup; `manual` waits for the merchant. */
  approval: z.enum(['auto', 'manual']).default('manual'),
  /** A personal code each approved affiliate gets, made in the discount engine. */
  coupon: z
    .object({
      enabled: z.boolean().default(true),
      /** What the shopper saves with the code. */
      bp: z.number().int().min(1).max(10_000).default(1000),
    })
    .default({ enabled: true, bp: 1000 }),
  tiers: z.array(TierSchema).max(10).default([]),
  /** Shown on the storefront signup page above the form. */
  pitch: z.string().max(2000).default(''),
  /** Program terms the affiliate accepts when applying. */
  terms: z.string().max(10_000).default(''),
  /** Extra questions on the signup page, after name and where they post. */
  form: z.array(SignupFieldSchema).max(10).default([]),
})
export type ProgramRules = z.infer<typeof ProgramRulesSchema>

/** The store-wide settings with one program's rules: what an order is worked out with. */
export const AffiliateSettingsSchema = StoreAffiliateSettingsSchema.extend(ProgramRulesSchema.shape)
export type AffiliateSettings = z.infer<typeof AffiliateSettingsSchema>

export const defaultAffiliateSettings: AffiliateSettings = AffiliateSettingsSchema.parse({})
export const defaultStoreAffiliateSettings: StoreAffiliateSettings =
  StoreAffiliateSettingsSchema.parse({})
export const defaultProgramRules: ProgramRules = ProgramRulesSchema.parse({})

/** A stored store entry (with any v1 program keys), or the defaults when it is missing or unreadable. */
export function parseAffiliateSettings(raw: unknown): AffiliateSettings {
  const r = AffiliateSettingsSchema.safeParse(raw ?? {})
  return r.success ? r.data : defaultAffiliateSettings
}

/** A program's stored rules, or the defaults when they are unreadable. Store-only keys are dropped. */
export function parseProgramRules(raw: unknown): ProgramRules {
  const r = ProgramRulesSchema.safeParse(raw ?? {})
  return r.success ? r.data : defaultProgramRules
}

/** Just the store-wide keys of a merged or stored entry. */
export function storePart(s: StoreAffiliateSettings): StoreAffiliateSettings {
  return {
    active: s.active,
    cookieDays: s.cookieDays,
    holdDays: s.holdDays,
    minPayoutPaise: s.minPayoutPaise,
    tds: s.tds,
    gst: s.gst,
    requirePanAboveThreshold: s.requirePanAboveThreshold,
    autoEnrol: s.autoEnrol,
    fraud: s.fraud,
  }
}

/** Just a program's keys of a merged entry. */
export function programPart(s: ProgramRules): ProgramRules {
  return {
    commission: s.commission,
    overrides: s.overrides,
    excludes: s.excludes,
    levels: s.levels,
    scope: s.scope,
    lifetimeDays: s.lifetimeDays,
    approval: s.approval,
    coupon: s.coupon,
    tiers: s.tiers,
    pitch: s.pitch,
    terms: s.terms,
    form: s.form,
  }
}

/** The store's settings with a program's rules on top. */
export function withProgramRules(
  store: StoreAffiliateSettings,
  rules: ProgramRules,
): AffiliateSettings {
  return { ...storePart(store), ...programPart(rules) }
}

/** A program's address in links (`/affiliate?program=<slug>`): lower-case letters, digits, dashes. */
export const PROGRAM_SLUG = /^[a-z0-9](?:[a-z0-9-]{0,38}[a-z0-9])?$/

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

/** Orders per click, as a percentage with one decimal; null with no clicks. */
export function conversionPercent(orders: number, clicks: number): number | null {
  return clicks > 0 ? Math.round((orders / clicks) * 1000) / 10 : null
}

/** Where an applicant says they will share their link (the signup form's "How will you promote?"). */
export const PROMOTE_CHANNELS = [
  'instagram',
  'youtube',
  'whatsapp',
  'facebook',
  'blog',
  'friends',
  'other',
] as const
export type PromoteChannel = (typeof PROMOTE_CHANNELS)[number]
/** The channels' names where no translated copy is at hand (the admin's affiliate page). */ export const PROMOTE_CHANNEL_LABELS: Record<
  PromoteChannel,
  string
> = {
  instagram: 'Instagram',
  youtube: 'YouTube',
  whatsapp: 'WhatsApp',
  facebook: 'Facebook',
  blog: 'Blog or website',
  friends: 'Friends and family',
  other: 'Somewhere else',
}

/** The answers key the chosen channels are kept under, comma-separated (not a form field id). */
export const PROMOTE_ANSWER = 'promote_via'

/** The channels an applicant ticked, known ones only, in the list's order. */
export function cleanChannels(raw: readonly unknown[] | undefined): PromoteChannel[] {
  const picked = new Set((raw ?? []).filter((v): v is string => typeof v === 'string'))
  return PROMOTE_CHANNELS.filter((c) => picked.has(c))
}

/**
 * What a program pays, for the signup headline: its default rule, and the best percent its
 * order-value levels or tiers can reach when that is higher ("10%, up to 15%"). Pure.
 */
export function programRate(rules: Pick<ProgramRules, 'commission' | 'levels' | 'tiers'>): {
  rule: CommissionRule
  upToBp: number | null
} {
  const base = rules.commission
  const best = Math.max(
    base.type === 'percent' ? base.bp : 0,
    ...rules.levels.map((l) => (l.rule.type === 'percent' ? l.rule.bp : 0)),
    ...(base.type === 'percent' ? rules.tiers.map((t) => t.bp) : []),
  )
  const upToBp = base.type === 'percent' && best > base.bp ? best : null
  return { rule: base, upToBp }
}

/** A buyer as an affiliate may see them: "R••• S.", never the full name. Pure. */
export function maskBuyer(name: string | null | undefined): string | null {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean)
  const first = parts[0]
  if (!first) return null
  const last = parts.length > 1 ? parts[parts.length - 1] : undefined
  return `${first.charAt(0).toUpperCase()}•••${last ? ` ${last.charAt(0).toUpperCase()}.` : ''}`
}
