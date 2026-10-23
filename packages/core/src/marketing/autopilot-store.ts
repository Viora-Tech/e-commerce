/** SOURCE OF TRUTH: Campaign Autopilot storage — WHAT: read and write `store.preferences.growthAutopilot` (settings, proposals, when it last planned) / WHY: Autopilot needs no table of its own; the write touches only its key so other preferences are never lost */
import { type StoreTx, store } from '@commerce/db'
import { eq, sql } from 'drizzle-orm'
import { type AutopilotState, AutopilotStateSchema, parseAutopilotState } from './autopilot'

export async function autopilotState(tx: StoreTx, storeId: string): Promise<AutopilotState> {
  const [row] = await tx
    .select({ preferences: store.preferences })
    .from(store)
    .where(eq(store.id, storeId))
  return parseAutopilotState(row?.preferences)
}

/** Replaces the stored Autopilot state (validated) and returns it. */
export async function saveAutopilotState(
  tx: StoreTx,
  storeId: string,
  next: AutopilotState,
): Promise<AutopilotState> {
  const state = AutopilotStateSchema.parse(next)
  await tx
    .update(store)
    .set({
      preferences: sql`jsonb_set(coalesce(${store.preferences}, '{}'::jsonb), '{growthAutopilot}', ${JSON.stringify(state)}::jsonb, true)`,
    })
    .where(eq(store.id, storeId))
  return state
}
