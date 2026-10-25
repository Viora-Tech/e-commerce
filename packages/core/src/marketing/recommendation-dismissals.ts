/** SOURCE OF TRUTH: dismissed growth recommendations — WHAT: read and write `store.preferences.growthRecommendations.dismissed` (rule id → when) / WHY: a dismissed card stays gone for the whole store without a table of its own; the write touches only its key so other preferences are never lost */
import { type StoreTx, store } from '@commerce/db'
import { eq, sql } from 'drizzle-orm'
import {
  type GrowthRecommendationPrefs,
  parseGrowthRecommendationPrefs,
  type RecommendationId,
} from './recommendations'

export async function growthRecommendationPrefs(
  tx: StoreTx,
  storeId: string,
): Promise<GrowthRecommendationPrefs> {
  const [row] = await tx
    .select({ preferences: store.preferences })
    .from(store)
    .where(eq(store.id, storeId))
  return parseGrowthRecommendationPrefs(row?.preferences)
}

/** Remembers a dismissal for the store; dismissing twice keeps the first time. */
export async function dismissGrowthRecommendation(
  tx: StoreTx,
  storeId: string,
  id: RecommendationId,
  at = new Date(),
): Promise<GrowthRecommendationPrefs> {
  const current = await growthRecommendationPrefs(tx, storeId)
  const next: GrowthRecommendationPrefs = {
    dismissed: { [id]: at.toISOString(), ...current.dismissed },
  }
  await tx
    .update(store)
    .set({
      preferences: sql`jsonb_set(coalesce(${store.preferences}, '{}'::jsonb), '{growthRecommendations}', ${JSON.stringify(next)}::jsonb, true)`,
    })
    .where(eq(store.id, storeId))
  return next
}
