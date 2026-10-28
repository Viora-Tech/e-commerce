/** SOURCE OF TRUTH: Koomerce plans — WHAT each plan includes and costs / WHY one place for the
 * Plan & billing page, Compare plans, the sidebar usage card and the billing service. Prices are
 * the owner's decision of 2026-10-28 (docs/superpowers/specs/2026-10-28-pricing-revamp-design.md,
 * memory-bank/pricing.md), before GST. Pure, client-safe.
 */

export const PLAN_IDS = ['starter', 'growth', 'pro', 'scale'] as const
export type PlanId = (typeof PLAN_IDS)[number]
export type BillingInterval = 'month' | 'year'

/** The AI plan (packages/ai plans.ts) each store plan grants; AI quotas live there. */
export type PlanAiTier = 'starter' | 'growth' | 'pro' | 'scale'

export type PlanDefinition = {
  id: PlanId
  /** Before GST, in paise. Yearly is two months free. */
  pricePaise: Record<BillingInterval, number>
  /**
   * Orders a month the plan includes; every order after that carries `feeBasisPoints` of its
   * total (billed on the 1st, `usage-fee.ts`). Orders are never blocked.
   */
  orders: number
  /** The per-order fee after the included orders, in hundredths of a percent (100 = 1%). */
  feeBasisPoints: number
  /** Fair-use storefront visits a month; null is judged by hand (Scale). Never blocks. */
  visitsPerMonth: number | null
  staff: number
  storageGb: number
  ai: PlanAiTier
  /**
   * Automations app limits (owner, 2026-10-23). `activeWorkflows: null` = unlimited. Runs are
   * counted per calendar month in India; Growth's marketing workflows never count.
   * `connectors`: HTTP request and plugin actions.
   */
  automations: { activeWorkflows: number | null; runsPerMonth: number; connectors: boolean }
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
    feeBasisPoints: 100,
    visitsPerMonth: 25_000,
    // The owner alone: staff counts every active member, the owner too.
    staff: 1,
    storageGb: 5,
    ai: 'starter',
    automations: { activeWorkflows: 5, runsPerMonth: 2_000, connectors: false },
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
    pricePaise: { month: 1_99_900, year: 19_99_000 },
    orders: 200,
    feeBasisPoints: 75,
    visitsPerMonth: 100_000,
    staff: 3,
    storageGb: 10,
    ai: 'growth',
    automations: { activeWorkflows: 25, runsPerMonth: 20_000, connectors: true },
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
    orders: 500,
    feeBasisPoints: 50,
    visitsPerMonth: 500_000,
    staff: 10,
    storageGb: 50,
    ai: 'pro',
    automations: { activeWorkflows: null, runsPerMonth: 200_000, connectors: true },
    features: {
      shopifyTheme: true,
      mcpApi: true,
      multiLocation: true,
      allApps: true,
      support: 'priority',
    },
  },
  scale: {
    id: 'scale',
    pricePaise: { month: 14_99_900, year: 1_49_99_000 },
    // No fee past the included orders either: the price is sized for 2,000, then fair use.
    orders: 2000,
    feeBasisPoints: 0,
    visitsPerMonth: null,
    staff: 25,
    storageGb: 100,
    ai: 'scale',
    automations: { activeWorkflows: null, runsPerMonth: 200_000, connectors: true },
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

/** A plan's place in the ladder, Starter 0 to Scale 3: what upgrade and downgrade compare. */
export const planRank = (plan: PlanId): number => PLAN_IDS.indexOf(plan)

/** Next plan up, for the over-the-limit nudge; null on Scale (Own it is the next step). */
export const nextPlanUp = (plan: PlanId): PlanId | null => PLAN_IDS[planRank(plan) + 1] ?? null
