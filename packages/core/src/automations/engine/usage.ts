/** SOURCE OF TRUTH: automation plan metering — WHAT: counts metered runs per store per calendar month in India against the plan's `automations.runsPerMonth`, counts active workflows against `activeWorkflows`, and reports usage / WHY: one place decides "Monthly run limit reached"; Growth-origin workflows are never metered or skipped (design §8.5, owner Q1). */
import { aiMonth } from '@commerce/ai'
import { automationUsage, automationWorkflow, type StoreTx } from '@commerce/db'
import { and, eq, ne, sql } from 'drizzle-orm'
import { PLANS, type PlanId } from '../../billing/plans'
import { ensureStorePlan } from '../../billing/service'

/** The metering bucket: calendar month in India, `YYYY-MM` (same as AI usage). */
export const usageMonth = (at: Date = new Date()): string => aiMonth(at)

export async function storePlanId(tx: StoreTx, storeId: string, now = new Date()): Promise<PlanId> {
  return (await ensureStorePlan(tx, storeId, now)).plan
}

export type MeterResult = { ok: boolean; runs: number; limit: number; crossed80: boolean }

/**
 * Takes one run from this month's allowance. Atomic: the upsert only increments while under
 * the limit, so two trigger jobs racing for the last run never both get it. `crossed80` says
 * this call is the one that reached 80% (the owner's warning email goes once).
 */
export async function meterRun(
  tx: StoreTx,
  storeId: string,
  plan: PlanId,
  now = new Date(),
): Promise<MeterResult> {
  const limit = PLANS[plan].automations.runsPerMonth
  const month = usageMonth(now)
  const rows = await tx.execute<{ runs: number }>(sql`
    insert into automation_usage (store_id, month, runs) values (${storeId}, ${month}, 1)
    on conflict (store_id, month) do update set runs = automation_usage.runs + 1
      where automation_usage.runs < ${limit}
    returning runs
  `)
  const runs = rows[0]?.runs
  if (runs === undefined) return { ok: false, runs: limit, limit, crossed80: false }
  return { ok: true, runs, limit, crossed80: runs === Math.ceil(limit * 0.8) }
}

/** This month's metered runs. */
export async function runsThisMonth(tx: StoreTx, storeId: string, now = new Date()) {
  const [row] = await tx
    .select({ runs: automationUsage.runs })
    .from(automationUsage)
    .where(and(eq(automationUsage.storeId, storeId), eq(automationUsage.month, usageMonth(now))))
  return row?.runs ?? 0
}

/** Workflows switched on that count against the plan (Growth's never do). */
export async function activeWorkflowCount(tx: StoreTx, storeId: string): Promise<number> {
  const [row] = await tx
    .select({ n: sql<number>`count(*)::int` })
    .from(automationWorkflow)
    .where(
      and(
        eq(automationWorkflow.storeId, storeId),
        eq(automationWorkflow.status, 'on'),
        ne(automationWorkflow.origin, 'growth'),
      ),
    )
  return row?.n ?? 0
}

/** Can one more (non-Growth) workflow be switched on? */
export async function canTurnOnAnother(tx: StoreTx, storeId: string, plan: PlanId) {
  const limit = PLANS[plan].automations.activeWorkflows
  return limit === null || (await activeWorkflowCount(tx, storeId)) < limit
}
