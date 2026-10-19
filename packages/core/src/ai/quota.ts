/** SOURCE OF TRUTH: AI call admission (feature switch, plan, monthly quota) — WHAT decides whether a store may make one more AI call and counts it / WHY the API guard and the worker's bulk runs admit and meter calls the same way */
import {
  type AiFeature,
  type AiPlan,
  aiMonth,
  checkQuota,
  isUnlimitedStore,
  type ModelTier,
  TIER_CALL_WEIGHT,
  tierFor,
} from '@commerce/ai'
import { type StoreTx, store } from '@commerce/db'
import { eq } from 'drizzle-orm'
import type { StoreContext } from '../context'
import { loadAiSettings, type StoreAiSettings } from './settings'
import { aiUsageForMonth, recordAiUsage } from './usage'

export type AiStoreFacts = { name: string; slug: string; currency: string; timezone: string }

/** The store row bits AI features need (name for prompts, slug for the unlimited list). */
export async function aiStoreFacts(tx: StoreTx, storeId: string): Promise<AiStoreFacts> {
  const [row] = await tx
    .select({
      name: store.name,
      slug: store.slug,
      currency: store.currency,
      timezone: store.timezone,
    })
    .from(store)
    .where(eq(store.id, storeId))
  return row ?? { name: 'your store', slug: '', currency: 'INR', timezone: 'Asia/Kolkata' }
}

/**
 * The plan that applies: the platform's own stores (AI_UNLIMITED_STORES) get Pro's tier. Their
 * separate no-quota bypass is in `admitAiCall`; Pro itself stops at its monthly credits.
 */
export function effectiveAiPlan(slug: string, stored: AiPlan): AiPlan {
  return slug && isUnlimitedStore(slug) ? 'pro' : stored
}

export type AiAdmission =
  | {
      ok: true
      plan: AiPlan
      tier: ModelTier
      month: string
      settings: StoreAiSettings
      store: AiStoreFacts
    }
  | { ok: false; reason: 'feature_off' }
  | { ok: false; reason: 'quota'; limit: 'credits' | 'calls' | 'tokens'; month: string }

/**
 * Admits one call of `feature` for the store and counts it (as `TIER_CALL_WEIGHT` requests:
 * a "Best" quality write costs more of the allowance). Runs inside the caller's transaction.
 */
export async function admitAiCall(
  ctx: StoreContext,
  feature: AiFeature,
  now: Date = new Date(),
): Promise<AiAdmission> {
  const month = aiMonth(now)
  const settings = await loadAiSettings(ctx)
  if (!settings.features[feature]) return { ok: false, reason: 'feature_off' }
  const facts = await aiStoreFacts(ctx.tx, ctx.storeId)
  const plan = effectiveAiPlan(facts.slug, settings.plan)
  const used = await aiUsageForMonth(ctx, month)
  // The platform's own stores (AI_UNLIMITED_STORES) are never limited; Pro shares their tier
  // but has 15,000 credits a month.
  const quota =
    facts.slug && isUnlimitedStore(facts.slug)
      ? ({ ok: true } as const)
      : checkQuota(plan, used.total, settings.extraCredits)
  if (!quota.ok) return { ok: false, reason: 'quota', limit: quota.reason, month }
  const tier = tierFor(feature, settings.writingQuality)
  await recordAiUsage(ctx, { month, feature, calls: TIER_CALL_WEIGHT[tier] })
  return { ok: true, plan, tier, month, settings, store: facts }
}
