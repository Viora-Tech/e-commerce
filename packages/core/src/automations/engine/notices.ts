/** SOURCE OF TRUTH: Automations owner notices and housekeeping — WHAT: the owner emails at 80% and 100% of the monthly run limit and when a workflow is switched off for a problem (circuit breaker, app removed), claimed once each inside the tick and sent after it commits; the daily history prune; switching workflows off when an app goes / WHY: design §8.5 (limits, breaker) and §8.3 retention; claiming in the transaction and sending outside it means a notice is never sent twice and no transaction waits on email. */
import {
  automationRun,
  automationStepRun,
  automationUsage,
  automationWorkflow,
  type Db,
  type StoreTx,
  store,
  withStore,
} from '@commerce/db'
import { and, eq, isNotNull, isNull, like, lt, ne, notInArray, or, sql } from 'drizzle-orm'
import type { PlatformCodeSender } from '../../accounts/deliver-code'
import { PLANS } from '../../billing/plans'
import { escapeHtml } from '../../marketing/email'
import { getPlatformEmail } from '../../sender-email/platform'
import { AUTOMATIONS_APP_ID } from '../app'
import { OPEN_RUN_STATUSES } from '../types'
import { storePlanId, usageMonth } from './usage'

export type OwnerNotice = { subject: string; text: string }

/** Step detail is kept this long; run summaries 13 months (design §8.3, owner: 90 days). */
export const STEP_DETAIL_DAYS = 90
const RUN_SUMMARY_MONTHS = 13

/**
 * Notices this store owes its owner, each claimed (marked sent) here so a second tick never
 * claims it again. The caller sends them after the transaction commits.
 */
export async function claimOwnerNotices(
  tx: StoreTx,
  storeId: string,
  now = new Date(),
): Promise<OwnerNotice[]> {
  const notices: OwnerNotice[] = []
  const month = usageMonth(now)
  const [usage] = await tx
    .select()
    .from(automationUsage)
    .where(and(eq(automationUsage.storeId, storeId), eq(automationUsage.month, month)))
  if (usage) {
    const limit = PLANS[await storePlanId(tx, storeId, now)].automations.runsPerMonth
    if (usage.runs >= limit && !usage.warnedAt100) {
      await tx
        .update(automationUsage)
        .set({ warnedAt100: now, warnedAt80: usage.warnedAt80 ?? now })
        .where(and(eq(automationUsage.storeId, storeId), eq(automationUsage.month, month)))
      notices.push({
        subject: 'Your automations stopped starting new runs this month',
        text: `Your store used all ${limit.toLocaleString('en-IN')} automation runs in your plan this month. New runs are skipped until next month; runs already going finish, and marketing automations keep running. Upgrade your plan to raise the limit.`,
      })
    } else if (usage.runs >= Math.ceil(limit * 0.8) && !usage.warnedAt80) {
      await tx
        .update(automationUsage)
        .set({ warnedAt80: now })
        .where(and(eq(automationUsage.storeId, storeId), eq(automationUsage.month, month)))
      notices.push({
        subject: 'Your automations have used 80% of this month’s runs',
        text: `Your store has used ${usage.runs.toLocaleString('en-IN')} of ${limit.toLocaleString('en-IN')} automation runs this month. At the limit, new runs are skipped until next month (marketing automations are not counted).`,
      })
    }
  }
  const problems = await tx
    .update(automationWorkflow)
    .set({ problemNotifiedAt: now })
    .where(
      and(
        eq(automationWorkflow.storeId, storeId),
        isNotNull(automationWorkflow.problem),
        isNull(automationWorkflow.problemNotifiedAt),
      ),
    )
    .returning({ name: automationWorkflow.name, problem: automationWorkflow.problem })
  for (const p of problems) {
    notices.push({
      subject: `Automation switched off: ${p.name}`,
      text: `${p.problem}. Open Apps → Automations to look at its runs, then switch it back on.`,
    })
  }
  return notices
}

/** Emails the store's contact address. Never throws: the notice is also on the workflow. */
export async function sendOwnerNotices(
  db: Db,
  storeId: string,
  notices: readonly OwnerNotice[],
  platform?: PlatformCodeSender,
): Promise<number> {
  if (notices.length === 0) return 0
  let sent = 0
  try {
    const [s] = await withStore(db, storeId, (tx) =>
      tx.select({ email: store.contactEmail }).from(store).where(eq(store.id, storeId)),
    )
    const transport = (platform ?? getPlatformEmail()).transport
    if (!s?.email?.includes('@') || !transport) return 0
    const channel = transport.channel({
      fromEmail: transport.fromEmail,
      fromName: transport.fromName,
      replyTo: undefined,
      using: 'platform',
    })
    if (!channel.sendMarketing) return 0
    for (const n of notices) {
      const r = await channel.sendMarketing({
        kind: 'email',
        to: { email: s.email },
        subject: n.subject,
        html: `<div style="font-family:sans-serif;white-space:pre-wrap">${escapeHtml(n.text)}</div>`,
        text: n.text,
      })
      if (r.ok) sent += 1
    }
  } catch {
    return sent
  }
  return sent
}

/** Daily: step detail past 90 days and finished runs past 13 months go. */
export async function pruneAutomationHistory(tx: StoreTx, now = new Date()) {
  const stepCutoff = new Date(now.getTime() - STEP_DETAIL_DAYS * 86_400_000)
  const runCutoff = new Date(now)
  runCutoff.setUTCMonth(runCutoff.getUTCMonth() - RUN_SUMMARY_MONTHS)
  const steps = await tx
    .delete(automationStepRun)
    .where(
      and(
        lt(automationStepRun.startedAt, stepCutoff),
        ne(automationStepRun.status, 'awaiting_approval'),
      ),
    )
    .returning({ id: automationStepRun.id })
  const runs = await tx
    .delete(automationRun)
    .where(
      and(
        lt(automationRun.startedAt, runCutoff),
        notInArray(automationRun.status, [...OPEN_RUN_STATUSES]),
      ),
    )
    .returning({ id: automationRun.id })
  return { steps: steps.length, runs: runs.length }
}

/**
 * An app was uninstalled: workflows that use its triggers or actions switch off (with the
 * reason shown on them). Removing Automations itself switches off every non-marketing workflow
 * (marketing ones block that uninstall). Growth's are never touched here.
 */
export async function onAppUninstalled(tx: StoreTx, storeId: string, pluginId: string) {
  const problem =
    pluginId === AUTOMATIONS_APP_ID
      ? 'Switched off: the Automations app was removed'
      : `Switched off: the app "${pluginId}" was removed`
  const prefix = `${pluginId}/%`
  const own =
    pluginId === AUTOMATIONS_APP_ID
      ? sql`true`
      : or(
          like(automationWorkflow.triggerType, prefix),
          sql`exists (
            select 1 from automation_version v,
              jsonb_each(v.definition->'nodes') n
            where v.id = ${automationWorkflow.publishedVersionId}
              and n.value->>'action' like ${prefix}
          )`,
        )
  const off = await tx
    .update(automationWorkflow)
    .set({ status: 'off', problem, problemNotifiedAt: new Date(), updatedAt: new Date() })
    .where(
      and(
        eq(automationWorkflow.storeId, storeId),
        eq(automationWorkflow.status, 'on'),
        ne(automationWorkflow.origin, 'growth'),
        own,
      ),
    )
    .returning({ id: automationWorkflow.id })
  return { switchedOff: off.length }
}

/** Ids of stores with automation history old enough to prune (SECURITY DEFINER backed). */
export async function storesWithOldAutomationHistory(db: Db, now = new Date()): Promise<string[]> {
  const cutoff = new Date(now.getTime() - STEP_DETAIL_DAYS * 86_400_000)
  const rows = await db.execute<{ id: string }>(
    sql`select stores_with_old_automation_history(${cutoff.toISOString()}::timestamptz) as id`,
  )
  return rows.map((r) => r.id)
}
