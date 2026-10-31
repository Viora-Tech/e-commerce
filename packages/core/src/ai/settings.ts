/** SOURCE OF TRUTH: store AI settings, AI plan, AI feature toggles, writing quality — WHAT reads and saves a store's AI plan, which AI features are on and which model tier writes / WHY Settings → AI, the API guard and the worker read one row */
import {
  type AiFeature,
  type AiFeatureToggles,
  type AiPlan,
  DEFAULT_AI_PLAN,
  parseAiPlan,
  parseFeatureToggles,
  parseWritingQuality,
  type WritingQuality,
} from '@commerce/ai/client'
import { aiSettings, storePlan } from '@commerce/db'
import { PLANS } from '../billing/plans'
import { eq, sql } from 'drizzle-orm'
import type { StoreContext } from '../context'

export type StoreAiSettings = {
  /** Set by the platform (billing, or a hand edit); merchants cannot change it. */
  plan: AiPlan
  features: AiFeatureToggles
  /** `best` routes long writing to the strong model (each call counts as more requests). */
  writingQuality: WritingQuality
  /** Bought AI credits still left (whole credits, fractions kept); used after the allowance. */
  extraCredits: number
}

/** Plan states that still give the plan's AI allowance (a bill due is in its grace days). */
const PLAN_IN_FORCE = new Set(['trialing', 'active', 'due'])

/**
 * The AI plan in force: Koomerce's own stores stay internal; otherwise the store's Koomerce
 * plan while it is trialing or paid, so a trial gets the same credits Plan & billing shows.
 * Without a plan in force, the stored AI plan (the default for a new store).
 */
async function planInForce(ctx: StoreContext, stored: AiPlan): Promise<AiPlan> {
  if (stored === 'internal') return stored
  const [row] = await ctx.tx
    .select({ plan: storePlan.plan, status: storePlan.status, unlimited: storePlan.unlimited })
    .from(storePlan)
    .where(eq(storePlan.storeId, ctx.storeId))
  if (!row) return stored
  if (row.unlimited) return 'internal'
  return PLAN_IN_FORCE.has(row.status) && row.plan in PLANS ? PLANS[row.plan].ai : stored
}

/** The store's AI settings; a store that never saved any gets the defaults (every feature on). */
export async function loadAiSettings(ctx: StoreContext): Promise<StoreAiSettings> {
  const [row] = await ctx.tx
    .select({
      plan: aiSettings.plan,
      features: aiSettings.features,
      writingQuality: aiSettings.writingQuality,
      extraCreditMillis: aiSettings.extraCreditMillis,
    })
    .from(aiSettings)
    .where(eq(aiSettings.storeId, ctx.storeId))
  if (!row) {
    return {
      plan: await planInForce(ctx, DEFAULT_AI_PLAN),
      features: parseFeatureToggles(null),
      writingQuality: 'standard',
      extraCredits: 0,
    }
  }
  return {
    plan: await planInForce(ctx, parseAiPlan(row.plan)),
    features: parseFeatureToggles(row.features),
    writingQuality: parseWritingQuality(row.writingQuality),
    extraCredits: row.extraCreditMillis / 1000,
  }
}

/** Turns AI features on or off and sets the writing quality. Leaves the plan alone. */
export async function saveAiFeatures(
  ctx: StoreContext,
  changes: Partial<Record<AiFeature, boolean>>,
  writingQuality?: WritingQuality,
): Promise<StoreAiSettings> {
  const current = await loadAiSettings(ctx)
  const features = { ...current.features, ...changes }
  const quality = writingQuality ?? current.writingQuality
  await ctx.tx
    .insert(aiSettings)
    .values({ storeId: ctx.storeId, features, writingQuality: quality })
    .onConflictDoUpdate({
      target: aiSettings.storeId,
      set: { features, writingQuality: quality, updatedAt: sql`now()` },
    })
  return {
    plan: current.plan,
    features,
    writingQuality: quality,
    extraCredits: current.extraCredits,
  }
}
