/** SOURCE OF TRUTH: the automation tick — WHAT: per store, every 30 s: runs whose wait or retry is due, runs a lost job left queued or running, approvals past their 72 h, and scheduled workflows whose time came (next fire in IST) / WHY: the database is the source of truth for every wait, so a Redis loss or a dropped job only delays a run, never loses it (design §8.5). */
import { IST_OFFSET_MS } from '@commerce/dates'
import { automationRun, automationStepRun, automationWorkflow, type StoreTx } from '@commerce/db'
import { and, asc, eq, inArray, isNull, lte, not, or, type SQL, sql } from 'drizzle-orm'
import { WorkflowDefinitionSchema } from '../definition'
import { type StartedRun, type StartOutcome, startRuns, type TriggerEvent } from './trigger'

/** A queued or running run untouched this long is assumed lost and re-enqueued. */
const STALE_RUN_MS = 5 * 60_000
const DUE_PER_TICK = 200

export type ScheduleConfig = { every: 'hour' | 'day' | 'week'; at?: string; weekday?: number }

/** The next fire time strictly after `from`, in IST (hourly, daily at HH:MM, weekly). */
export function nextFireAt(config: ScheduleConfig, from: Date): Date {
  if (config.every === 'hour') {
    const next = new Date(from.getTime())
    next.setUTCMinutes(0, 0, 0)
    next.setUTCHours(next.getUTCHours() + 1)
    return next
  }
  const [hh, mm] = (config.at ?? '09:00').split(':').map(Number) as [number, number]
  // Work in "IST wall clock as UTC" so date arithmetic is plain.
  const local = new Date(from.getTime() + IST_OFFSET_MS)
  const candidate = new Date(
    Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate(), hh, mm),
  )
  let days = 0
  if (config.every === 'day') {
    if (candidate.getTime() <= local.getTime()) days = 1
  } else {
    const want = config.weekday ?? 1
    days = (want - candidate.getUTCDay() + 7) % 7
    if (days === 0 && candidate.getTime() <= local.getTime()) days = 7
  }
  return new Date(candidate.getTime() + days * 86_400_000 - IST_OFFSET_MS)
}

export type TickOutcome = {
  /** Runs to enqueue now. */
  due: { runId: string; nextAt: Date }[]
  expired: number
  scheduled: StartedRun[]
}

/** Approvals nobody decided in time: declined as `approval_expired`, the run moves on. */
async function expireApprovals(tx: StoreTx, storeId: string, now: Date) {
  const rows = await tx
    .update(automationStepRun)
    .set({ status: 'cancelled', error: 'approval_expired', decidedAt: now, finishedAt: now })
    .where(
      and(
        eq(automationStepRun.storeId, storeId),
        eq(automationStepRun.status, 'awaiting_approval'),
        lte(automationStepRun.approvalExpiresAt, now),
      ),
    )
    .returning({ runId: automationStepRun.runId })
  if (rows.length === 0) return 0
  await tx
    .update(automationRun)
    .set({ status: 'queued', nextAt: now })
    .where(
      and(
        inArray(
          automationRun.id,
          rows.map((r) => r.runId),
        ),
        eq(automationRun.status, 'awaiting_approval'),
      ),
    )
  return rows.length
}

async function fireSchedules(tx: StoreTx, storeId: string, now: Date): Promise<StartedRun[]> {
  const workflows = await tx
    .select({ id: automationWorkflow.id, nextFireAt: automationWorkflow.nextFireAt })
    .from(automationWorkflow)
    .where(
      and(
        eq(automationWorkflow.storeId, storeId),
        eq(automationWorkflow.status, 'on'),
        eq(automationWorkflow.triggerType, 'schedule'),
        or(isNull(automationWorkflow.nextFireAt), lte(automationWorkflow.nextFireAt, now)),
      ),
    )
  const started: StartedRun[] = []
  for (const wf of workflows) {
    const def = await publishedDefinition(tx, wf.id)
    if (!def) continue
    const config = def.trigger.config as ScheduleConfig
    if (wf.nextFireAt) {
      const r = await startRuns(
        tx,
        storeId,
        {
          triggerIds: ['schedule'],
          key: `schedule:${wf.nextFireAt.toISOString()}`,
          subject: { type: 'none', id: null },
          data: { firedAt: wf.nextFireAt.toISOString() },
          cause: null,
          workflowIds: [wf.id],
        },
        now,
      )
      started.push(...r.started)
    }
    await tx
      .update(automationWorkflow)
      .set({ nextFireAt: nextFireAt(config, now) })
      .where(eq(automationWorkflow.id, wf.id))
  }
  return started
}

/** The live definition of a workflow, or null. */
async function publishedDefinition(tx: StoreTx, workflowId: string) {
  const rows = await tx.execute<{ definition: unknown }>(sql`
    select v.definition from automation_workflow w
    join automation_version v on v.id = w.published_version_id
    where w.id = ${workflowId}
  `)
  const parsed = rows[0] ? WorkflowDefinitionSchema.safeParse(rows[0].definition) : null
  return parsed?.success ? parsed.data : null
}

/**
 * Sweep trigger sources run by the tick (Growth's abandoned checkout, abandoned cart, browse
 * abandonment and lapsed customer). Each finds its records and starts runs through `start`; runs it starts are queued
 * now, so the due query below returns them in the same tick.
 */
export type TickSweep = (
  tx: StoreTx,
  storeId: string,
  now: Date,
  start: (event: TriggerEvent) => Promise<StartOutcome>,
) => Promise<unknown>

/** One store's due work. The caller enqueues `due` and `scheduled` after the commit. */
export async function automationTick(
  tx: StoreTx,
  storeId: string,
  now = new Date(),
  opts: { sweeps?: readonly TickSweep[] | undefined } = {},
): Promise<TickOutcome> {
  const expired = await expireApprovals(tx, storeId, now)
  const scheduled = await fireSchedules(tx, storeId, now)
  for (const sweep of opts.sweeps ?? []) {
    await sweep(tx, storeId, now, (event) => startRuns(tx, storeId, event, now))
  }

  // Lost runs get a fresh `next_at` so their step job id is new (a failed job's id lingers).
  const stale = new Date(now.getTime() - STALE_RUN_MS)
  await tx
    .update(automationRun)
    .set({ nextAt: now })
    .where(
      and(
        eq(automationRun.storeId, storeId),
        inArray(automationRun.status, ['queued', 'running']),
        lte(automationRun.nextAt, stale),
      ),
    )
  const due = await tx
    .select({ runId: automationRun.id, nextAt: automationRun.nextAt })
    .from(automationRun)
    .innerJoin(automationWorkflow, eq(automationWorkflow.id, automationRun.workflowId))
    .where(
      and(
        eq(automationRun.storeId, storeId),
        // A paused Growth workflow holds its runs (Growth parity); everything else finishes.
        not(
          and(eq(automationWorkflow.status, 'off'), eq(automationWorkflow.origin, 'growth')) as SQL,
        ),
        or(
          and(eq(automationRun.status, 'waiting'), lte(automationRun.nextAt, now)),
          and(eq(automationRun.status, 'queued'), lte(automationRun.nextAt, now)),
          and(eq(automationRun.status, 'running'), eq(automationRun.nextAt, now)),
        ),
      ),
    )
    .orderBy(asc(automationRun.nextAt))
    .limit(DUE_PER_TICK)
  return { due, expired, scheduled }
}
