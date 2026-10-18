/**
 * Paid apps (memory-bank/pricing.md): core apps and every connection are free on every plan;
 * the apps below are included from a plan up and bought per month below it. Pure and
 * client-safe (exported through `@commerce/core/billing`).
 */
import { PLAN_IDS, type PlanId } from './plans'

export type AppPrice = {
  /** For bills and emails ("Reviews app"). */
  name: string
  /** The lowest plan that includes the app. */
  includedFrom: PlanId
  /** Per month (before GST) on a plan below `includedFrom`. */
  pricePaise: number
}

/** First-party apps that cost extra below a plan. Anything not listed is free on every plan. */
export const APP_PRICING: Readonly<Record<string, AppPrice>> = {
  reviews: { name: 'Reviews', includedFrom: 'growth', pricePaise: 199_00 },
  'back-in-stock': { name: 'Back in stock', includedFrom: 'growth', pricePaise: 149_00 },
  forms: { name: 'Forms', includedFrom: 'growth', pricePaise: 99_00 },
  'emi-pay-later': { name: 'EMI & pay later', includedFrom: 'pro', pricePaise: 149_00 },
  'google-search-console': {
    name: 'Google Search Console',
    includedFrom: 'pro',
    pricePaise: 199_00,
  },
}

/** The sales store's product variant that bills one month of an app. */
export const appSku = (pluginId: string) => `app-${pluginId}-month`

const rank = (plan: PlanId) => PLAN_IDS.indexOf(plan)

/**
 * Where an app stands for a store:
 * - `free`: costs nothing on any plan.
 * - `included`: the store's plan includes it.
 * - `bought`: paid for through `until`.
 * - `buy`: needs buying (or a bigger plan) before it can be installed.
 */
export type AppAccess =
  | { state: 'free' }
  | { state: 'included'; plan: PlanId }
  | { state: 'bought'; until: Date; renews: boolean }
  | { state: 'buy'; pricePaise: number; includedFrom: PlanId }

export function appAccess(
  pluginId: string,
  plan: PlanId,
  bought: { until: Date; renews: boolean } | null,
  now = new Date(),
): AppAccess {
  const price = APP_PRICING[pluginId]
  if (!price) return { state: 'free' }
  if (rank(plan) >= rank(price.includedFrom)) return { state: 'included', plan }
  if (bought && bought.until > now) return { state: 'bought', ...bought }
  return { state: 'buy', pricePaise: price.pricePaise, includedFrom: price.includedFrom }
}

/** Can be installed (or kept working) right now. */
export const canUseApp = (a: AppAccess) => a.state !== 'buy'

/** A top-up of AI credits (memory-bank/pricing.md): bought credits carry over until used. */
export const AI_CREDIT_PACK = {
  credits: 1_000,
  pricePaise: 199_00,
  sku: 'ai-credits-1000',
} as const
