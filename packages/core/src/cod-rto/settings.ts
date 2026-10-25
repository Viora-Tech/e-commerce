/** SOURCE OF TRUTH: COD & RTO app settings — WHAT: the app id, the merchant's settings (COD confirmation link and its deadlines, the risk score's levels and order tags, the COD rules from the score, partial prepaid) kept in `store.apps.settings['cod-rto']` with no table, and the order tags the app writes / WHY: checkout, the worker's sweep, the notifications and the admin pages must read one shape. Pure, no database, so admin client components import it through `@commerce/core/cod-rto`. */
import { z } from 'zod'

export const COD_RTO_APP_ID = 'cod-rto'

/** Order tags the app adds, so the Orders list (Tags column, bulk tags) and automations see them. */
export const COD_RTO_TAGS = {
  highRisk: 'rto-risk-high',
  unconfirmed: 'cod-unconfirmed',
} as const

const RISK_LEVELS = ['low', 'medium', 'high'] as const
export type RiskLevel = (typeof RISK_LEVELS)[number]

const COD_VERIFICATIONS = ['pending', 'confirmed', 'cancelled', 'unconfirmed'] as const
export type CodVerification = (typeof COD_VERIFICATIONS)[number]

/** The risky-orders page's tabs: medium and high, high only, no answer, waiting, everything checked. */
export const RISK_ORDER_FILTERS = ['risky', 'high', 'unconfirmed', 'pending', 'all'] as const
export type RiskOrderFilter = (typeof RISK_ORDER_FILTERS)[number]

/** Hour limits for the confirmation deadlines (1 hour to a week). */
const COD_HOURS = { min: 1, max: 168 } as const

const hours = (fallback: number) =>
  z.number().int().min(COD_HOURS.min).max(COD_HOURS.max).default(fallback)

const CodVerificationSettingsSchema = z.object({
  /** Send the shopper a confirm / cancel link after a cash on delivery order. */
  enabled: z.boolean().default(true),
  /** Every COD order, or only those the score calls medium or high risk. */
  sendTo: z.enum(['all', 'risky']).default('all'),
  /** No answer after this long: the order is flagged (tag + note) for the merchant to call. */
  flagAfterHours: hours(24),
  /** Cancel an order nobody confirmed. Off by default: a missed message should not lose a sale. */
  autoCancel: z.boolean().default(false),
  autoCancelAfterHours: hours(48),
})

const RiskSettingsSchema = z.object({
  /** Scores at or above this are medium risk. */
  mediumAt: z.number().int().min(1).max(99).default(30),
  /** Scores at or above this are high risk. */
  highAt: z.number().int().min(2).max(100).default(60),
  /** Tag high-risk orders `rto-risk-high`, so the Orders list can show and filter them. */
  tagOrders: z.boolean().default(true),
})

const CodRuleSettingsSchema = z.object({
  /** Refuse cash on delivery at checkout when the score is high (the shopper pays online). */
  hideCodForHighRisk: z.boolean().default(false),
  /**
   * Ask for part of a big COD order up front. Saved and checked by `codPrepaidDuePaise`; the
   * checkout's split payment (pay a part online, the rest at the door) is a later step.
   */
  partialPrepaid: z
    .object({
      enabled: z.boolean().default(false),
      /** Orders above this value (paise) need the part up front. */
      abovePaise: z.number().int().min(0).default(500_000),
      /** How much of the order total, in percent. */
      percent: z.number().int().min(1).max(90).default(20),
    })
    .prefault({}),
})

export const CodRtoSettingsSchema = z
  .object({
    verification: CodVerificationSettingsSchema.prefault({}),
    risk: RiskSettingsSchema.prefault({}),
    rules: CodRuleSettingsSchema.prefault({}),
  })
  .refine((s) => s.risk.highAt > s.risk.mediumAt, {
    message: 'High risk must start above medium risk',
    path: ['risk', 'highAt'],
  })
export type CodRtoSettings = z.infer<typeof CodRtoSettingsSchema>
export type CodRtoSettingsInput = z.input<typeof CodRtoSettingsSchema>

const defaultCodRtoSettings: CodRtoSettings = CodRtoSettingsSchema.parse({})

/** The app's entry in `store.apps.settings`, falling back to the defaults when missing or invalid. */
export function parseCodRtoSettings(raw: unknown): CodRtoSettings {
  const r = CodRtoSettingsSchema.safeParse(raw ?? {})
  return r.success ? r.data : defaultCodRtoSettings
}

/**
 * The part of a COD order to pay up front under the partial-prepaid rule; 0 when the rule is
 * off or the order is at or under the threshold. Rounded up to a whole rupee.
 */
export function codPrepaidDuePaise(
  rules: CodRtoSettings['rules'],
  orderTotalPaise: number,
): number {
  const p = rules.partialPrepaid
  if (!p.enabled || orderTotalPaise <= p.abovePaise) return 0
  return Math.min(orderTotalPaise, Math.ceil((orderTotalPaise * p.percent) / 100 / 100) * 100)
}

/** Whether this order's shopper gets the confirm link, from the settings and its risk level. */
export function wantsCodConfirmation(
  settings: CodRtoSettings,
  order: { paymentMethod: string | null; level: RiskLevel | null },
): boolean {
  if (order.paymentMethod !== 'cod' || !settings.verification.enabled) return false
  if (settings.verification.sendTo === 'all') return true
  return order.level === 'medium' || order.level === 'high'
}
