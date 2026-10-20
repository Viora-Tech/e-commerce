/** SOURCE OF TRUTH: Koomerce plans — WHAT each plan includes and costs / WHY one place for the
 * Plan & billing page, Compare plans, the sidebar usage card and the billing service. Prices are
 * the owner's decision of 2026-10-18 (memory-bank/pricing.md), before GST. Pure, client-safe.
 */

export const PLAN_IDS = ['starter', 'growth', 'pro'] as const
export type PlanId = (typeof PLAN_IDS)[number]
export type BillingInterval = 'month' | 'year'

/** The AI plan (packages/ai plans.ts) each store plan grants; AI quotas live there. */
export type PlanAiTier = 'starter' | 'growth' | 'pro'

export type PlanDefinition = {
  id: PlanId
  /** Before GST, in paise. Yearly is two months free. */
  pricePaise: Record<BillingInterval, number>
  /** Orders a month before the upgrade prompt; orders are never blocked. */
  orders: number
  staff: number
  storageGb: number
  ai: PlanAiTier
  /** Plan features the Compare plans table ticks. */
  features: {
    shopifyTheme: boolean
    mcpApi: boolean
    multiLocation: boolean
    allApps: boolean
    support: 'email' | 'whatsapp' | 'priority'
  }
}

export const PLANS: Record<PlanId, PlanDefinition> = {
  starter: {
    id: 'starter',
    pricePaise: { month: 49_900, year: 4_99_000 },
    orders: 50,
    staff: 2,
    storageGb: 2,
    ai: 'starter',
    features: {
      shopifyTheme: false,
      mcpApi: false,
      multiLocation: false,
      allApps: false,
      support: 'email',
    },
  },
  growth: {
    id: 'growth',
    pricePaise: { month: 1_49_900, year: 14_99_000 },
    orders: 200,
    staff: 5,
    storageGb: 10,
    ai: 'growth',
    features: {
      shopifyTheme: true,
      mcpApi: false,
      multiLocation: false,
      allApps: false,
      support: 'whatsapp',
    },
  },
  pro: {
    id: 'pro',
    pricePaise: { month: 4_99_900, year: 49_99_000 },
    orders: 1000,
    staff: 15,
    storageGb: 50,
    ai: 'pro',
    features: {
      shopifyTheme: true,
      mcpApi: true,
      multiLocation: true,
      allApps: true,
      support: 'priority',
    },
  },
}

/** New stores try Growth for this long, no card asked. */
export const TRIAL_DAYS = 14
/** A renewal order is created this many days before a period (or trial) ends. */
export const RENEW_AHEAD_DAYS = 3
/** After a period ends unpaid, the store keeps working this long before it is paused. */
export const GRACE_DAYS = 7
/** GST on the plan price. */
export const PLAN_GST_PERCENT = 18

export const isPlanId = (v: unknown): v is PlanId => PLAN_IDS.includes(v as PlanId)

/** The SKU of a plan's variant on the platform sales store, e.g. `plan-growth-month`. */
export const planSku = (plan: PlanId, interval: BillingInterval): string =>
  `plan-${plan}-${interval}`

/** Months a bill covers. */
const intervalMonths = (interval: BillingInterval): number => (interval === 'year' ? 12 : 1)

/** `from` moved forward by one billing interval (calendar months, so 31 Jan → 28 Feb). */
export function addInterval(from: Date, interval: BillingInterval): Date {
  const d = new Date(from)
  const day = d.getUTCDate()
  d.setUTCDate(1)
  d.setUTCMonth(d.getUTCMonth() + intervalMonths(interval))
  const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate()
  d.setUTCDate(Math.min(day, last))
  return d
}

/** Next plan up, for the over-the-limit nudge; null on Pro (Own it is the next step). */
export const nextPlanUp = (plan: PlanId): PlanId | null =>
  plan === 'starter' ? 'growth' : plan === 'growth' ? 'pro' : null
