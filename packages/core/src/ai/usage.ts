/** SOURCE OF TRUTH: AI usage metering — WHAT counts AI calls and tokens per store, month and feature / WHY the monthly quota and Settings → AI read the same numbers */
import { AI_FEATURES, type AiFeature, type AiUsageTotals } from '@commerce/ai/client'
import { aiUsage } from '@commerce/db'
import { and, eq, sql } from 'drizzle-orm'
import type { StoreContext } from '../context'

export type AiMonthUsage = {
  month: string
  total: AiUsageTotals
  byFeature: Record<AiFeature, AiUsageTotals>
}

const empty = (): AiUsageTotals => ({ calls: 0, inputTokens: 0, outputTokens: 0 })

/** Calls and tokens the store used in `month` (`YYYY-MM`, India), per feature and in total. */
export async function aiUsageForMonth(ctx: StoreContext, month: string): Promise<AiMonthUsage> {
  const rows = await ctx.tx
    .select({
      feature: aiUsage.feature,
      calls: aiUsage.calls,
      inputTokens: aiUsage.inputTokens,
      outputTokens: aiUsage.outputTokens,
    })
    .from(aiUsage)
    .where(and(eq(aiUsage.storeId, ctx.storeId), eq(aiUsage.month, month)))
  const byFeature = Object.fromEntries(AI_FEATURES.map((f) => [f, empty()])) as Record<
    AiFeature,
    AiUsageTotals
  >
  const total = empty()
  for (const row of rows) {
    const bucket = byFeature[row.feature as AiFeature]
    for (const target of bucket ? [bucket, total] : [total]) {
      target.calls += row.calls
      target.inputTokens += row.inputTokens
      target.outputTokens += row.outputTokens
    }
  }
  return { month, total, byFeature }
}

/**
 * Adds one call and/or tokens to the store's month. The call is counted when it starts (so a
 * call that fails still counts against the limit) and the tokens when the model reports them.
 * One upsert, so concurrent calls never lose a count.
 */
export async function recordAiUsage(
  ctx: StoreContext,
  input: {
    month: string
    feature: AiFeature
    calls?: number | undefined
    inputTokens?: number | undefined
    outputTokens?: number | undefined
  },
): Promise<void> {
  const calls = input.calls ?? 0
  const inputTokens = Math.max(0, Math.round(input.inputTokens ?? 0))
  const outputTokens = Math.max(0, Math.round(input.outputTokens ?? 0))
  await ctx.tx
    .insert(aiUsage)
    .values({
      storeId: ctx.storeId,
      month: input.month,
      feature: input.feature,
      calls,
      inputTokens,
      outputTokens,
    })
    .onConflictDoUpdate({
      target: [aiUsage.storeId, aiUsage.month, aiUsage.feature],
      set: {
        calls: sql`${aiUsage.calls} + ${calls}`,
        inputTokens: sql`${aiUsage.inputTokens} + ${inputTokens}`,
        outputTokens: sql`${aiUsage.outputTokens} + ${outputTokens}`,
        updatedAt: sql`now()`,
      },
    })
}
