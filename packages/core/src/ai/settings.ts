/** SOURCE OF TRUTH: store AI settings, AI plan, AI feature toggles — WHAT reads and saves a store's AI plan and which AI features are on / WHY Settings → AI and the API guard read one row */
import {
  type AiFeature,
  type AiFeatureToggles,
  type AiPlan,
  DEFAULT_AI_PLAN,
  parseAiPlan,
  parseFeatureToggles,
} from '@commerce/ai/client'
import { aiSettings } from '@commerce/db'
import { eq, sql } from 'drizzle-orm'
import type { StoreContext } from '../context'

export type StoreAiSettings = {
  /** Set by the platform (billing, or a hand edit); merchants cannot change it. */
  plan: AiPlan
  features: AiFeatureToggles
}

/** The store's AI settings; a store that never saved any gets the defaults (every feature on). */
export async function loadAiSettings(ctx: StoreContext): Promise<StoreAiSettings> {
  const [row] = await ctx.tx
    .select({ plan: aiSettings.plan, features: aiSettings.features })
    .from(aiSettings)
    .where(eq(aiSettings.storeId, ctx.storeId))
  if (!row) return { plan: DEFAULT_AI_PLAN, features: parseFeatureToggles(null) }
  return { plan: parseAiPlan(row.plan), features: parseFeatureToggles(row.features) }
}

/** Turns AI features on or off for the store. Leaves the plan alone. */
export async function saveAiFeatures(
  ctx: StoreContext,
  changes: Partial<Record<AiFeature, boolean>>,
): Promise<StoreAiSettings> {
  const current = await loadAiSettings(ctx)
  const features = { ...current.features, ...changes }
  await ctx.tx
    .insert(aiSettings)
    .values({ storeId: ctx.storeId, features })
    .onConflictDoUpdate({
      target: aiSettings.storeId,
      set: { features, updatedAt: sql`now()` },
    })
  return { plan: current.plan, features }
}
