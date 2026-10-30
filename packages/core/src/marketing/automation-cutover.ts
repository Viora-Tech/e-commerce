/** SOURCE OF TRUTH: Growth automations cutover — WHAT: the per-store flag (`store.preferences.automationsEngine`, legacy | engine) that says which runner owns a store's marketing automations, the lock both sides take on it, and the one-transaction cutover that copies every `marketing_automation` and its runs onto the engine (same ids) and flips the flag / WHY: design §10: no store is ever run by both runners, and a shopper mid-sequence gets exactly the messages they would have got (no double send, no lost run). Server-only. */
import {
  automationRun,
  automationRunRecord,
  automationVersion,
  automationWorkflow,
  marketingAutomation,
  marketingAutomationRun,
  type StoreTx,
  store,
} from '@commerce/db'
import { and, eq, inArray, sql } from 'drizzle-orm'
import { isLegacyTrigger, mapAutomation, mapRun } from './automation-engine-map'
import type { AutomationTrigger } from './automation-steps'

export type AutomationsEngineMode = 'legacy' | 'engine'

/** The store's runner, read without a lock (lists, the admin). */
export async function automationsEngineMode(
  tx: StoreTx,
  storeId: string,
): Promise<AutomationsEngineMode> {
  const [row] = await tx
    .select({ mode: sql<string | null>`${store.preferences}->>'automationsEngine'` })
    .from(store)
    .where(eq(store.id, storeId))
  return row?.mode === 'engine' ? 'engine' : 'legacy'
}

/**
 * The store's runner, holding a share lock on the store row until the transaction ends. Every
 * legacy writer (tick, enrolment, conversions) takes it first, and the cutover takes the row
 * `FOR UPDATE`, so a legacy write either commits before the cutover copies, or waits and then
 * sees `engine` and does nothing. Nothing lands in the old tables after the copy.
 */
export async function lockAutomationsEngineMode(
  tx: StoreTx,
  storeId: string,
): Promise<AutomationsEngineMode> {
  const rows = (await tx.execute(
    sql`select preferences->>'automationsEngine' as mode from store where id = ${storeId} for share`,
  )) as unknown as { mode: string | null }[]
  return rows[0]?.mode === 'engine' ? 'engine' : 'legacy'
}

/** True when the legacy runner still owns the store (takes the share lock, see above). */
export async function legacyOwnsStore(tx: StoreTx, storeId: string): Promise<boolean> {
  return (await lockAutomationsEngineMode(tx, storeId)) === 'legacy'
}

async function setMode(tx: StoreTx, storeId: string, mode: AutomationsEngineMode) {
  await tx
    .update(store)
    .set({
      preferences: sql`coalesce(${store.preferences}, '{}'::jsonb) || ${JSON.stringify({ automationsEngine: mode })}::jsonb`,
    })
    .where(eq(store.id, storeId))
}

export type CutoverReport = {
  storeId: string
  /** The store was on the engine already; nothing was copied. */
  alreadyEngine: boolean
  workflows: number
  /** Automations with an unknown trigger, left behind (reported, never copied). */
  skippedAutomations: string[]
  runs: number
  /** Runs still in a sequence (old `active`, now `waiting`). */
  openRuns: number
  /** Marketing messages linked to their engine run and node. */
  messagesLinked: number
}

const CHUNK = 500

/**
 * Moves one store's Growth automations onto the engine, in the caller's `withStore`
 * transaction (roll it back for a dry run):
 *
 * 1. Lock the store row (`FOR UPDATE`, see `lockAutomationsEngineMode`) and the store's old
 *    automations and runs; a store already on the engine is left alone (idempotent).
 * 2. Each `marketing_automation` becomes an `automation_workflow` with the same id
 *    (`origin='growth'`, never metered) and version 1 holding the mapped definition.
 * 3. Each run (every status, so stats carry over) becomes an `automation_run` with the same
 *    id, trigger key, next due time and marketing columns; open runs wait on the node at their
 *    step index. Its subject is recorded for record history.
 * 4. Each of its messages gets `automation_run_id` / `automation_node_id`, so the engine's
 *    one-message-per-node rule also covers steps the old runner already sent.
 * 5. The flag flips to `engine`. Any failure rolls everything back and the store stays legacy.
 */
export async function cutoverStoreToEngine(tx: StoreTx, storeId: string): Promise<CutoverReport> {
  const report: CutoverReport = {
    storeId,
    alreadyEngine: false,
    workflows: 0,
    skippedAutomations: [],
    runs: 0,
    openRuns: 0,
    messagesLinked: 0,
  }
  await tx.execute(sql`select id from store where id = ${storeId} for update`)
  if ((await automationsEngineMode(tx, storeId)) === 'engine') {
    return { ...report, alreadyEngine: true }
  }

  const automations = await tx
    .select()
    .from(marketingAutomation)
    .where(eq(marketingAutomation.storeId, storeId))
    .for('update')
  for (const a of automations) {
    const mapped = mapAutomation(a)
    if (!mapped || !isLegacyTrigger(a.trigger)) {
      report.skippedAutomations.push(a.id)
      continue
    }
    const trigger: AutomationTrigger = a.trigger
    await tx.insert(automationWorkflow).values({
      id: a.id,
      storeId,
      name: a.name,
      status: mapped.status,
      origin: 'growth',
      templateId: a.template,
      triggerType: mapped.triggerType,
      createdAt: a.createdAt,
      updatedAt: a.updatedAt,
    })
    const [version] = await tx
      .insert(automationVersion)
      .values({
        storeId,
        workflowId: a.id,
        number: 1,
        definition: mapped.definition as unknown as Record<string, unknown>,
        publishedAt: a.updatedAt,
      })
      .returning({ id: automationVersion.id })
    const versionId = version?.id as string
    await tx
      .update(automationWorkflow)
      .set({ publishedVersionId: versionId })
      .where(eq(automationWorkflow.id, a.id))
    report.workflows += 1

    const runs = await tx
      .select()
      .from(marketingAutomationRun)
      .where(eq(marketingAutomationRun.automationId, a.id))
      .for('update')
    for (let i = 0; i < runs.length; i += CHUNK) {
      const batch = runs.slice(i, i + CHUNK)
      const rows = batch.map((r) => {
        const m = mapRun(trigger, mapped.nodeIds, r)
        if (m.status === 'waiting') report.openRuns += 1
        return {
          run: {
            id: r.id,
            storeId,
            workflowId: a.id,
            versionId,
            triggerType: mapped.triggerType,
            triggerKey: r.triggerKey,
            subjectType: m.subjectType,
            subjectId: m.subjectId,
            status: m.status,
            cursor: m.cursor,
            nextAt: r.nextAt,
            metered: false,
            triggerData: {
              migratedFrom: 'marketing_automation_run',
              stepIndex: r.stepIndex,
              // Browse abandonment: the product its email is about.
              ...(r.productId ? { productId: r.productId } : {}),
            },
            customerId: r.customerId,
            cartId: r.cartId,
            orderId: r.orderId,
            email: r.email,
            phone: r.phone,
            name: r.name,
            convertedOrderId: r.convertedOrderId,
            stopReason: r.stopReason,
            startedAt: r.startedAt,
            finishedAt: r.finishedAt,
          },
          subject: m.subjectId ? { type: m.subjectType, id: m.subjectId } : null,
        }
      })
      await tx.insert(automationRun).values(rows.map((x) => x.run))
      const records = rows.flatMap((x) =>
        x.subject
          ? [
              {
                runId: x.run.id,
                storeId,
                recordType: x.subject.type,
                recordId: x.subject.id,
                role: 'subject' as const,
                createdAt: x.run.startedAt,
              },
            ]
          : [],
      )
      if (records.length > 0) await tx.insert(automationRunRecord).values(records)
      report.runs += batch.length
    }

    // Old messages point at (run, step index); give them the engine's (run, node).
    const nodeIds = mapped.nodeIds
    if (nodeIds.length > 0) {
      const linked = (await tx.execute(sql`
        update marketing_message m
        set automation_run_id = m.run_id,
            automation_node_id = (${sql.raw(`array[${nodeIds.map((n) => `'${n}'`).join(',')}]`)}::text[])[m.step_index + 1]
        where m.automation_id = ${a.id} and m.run_id is not null and m.step_index is not null
          and m.automation_run_id is null
        returning m.id`)) as unknown as { id: string }[]
      report.messagesLinked += linked.length
    }
  }

  await setMode(tx, storeId, 'engine')
  return report
}

/** Per-store comparison the verify step prints: old tables vs engine tables. */
export type CutoverCheck = {
  workflowId: string
  legacy: { runs: number; active: number; converted: number; nextDue: string | null }
  engine: { runs: number; open: number; converted: number; nextDue: string | null }
  ok: boolean
}

/** Design §10 step 5: run counts, open runs, conversions and next due time match per workflow. */
export async function verifyCutover(tx: StoreTx, storeId: string): Promise<CutoverCheck[]> {
  const ids = (
    await tx
      .select({ id: marketingAutomation.id })
      .from(marketingAutomation)
      .where(eq(marketingAutomation.storeId, storeId))
  ).map((r) => r.id)
  if (ids.length === 0) return []
  const legacy = await tx
    .select({
      id: marketingAutomationRun.automationId,
      runs: sql<number>`count(*)::int`,
      active: sql<number>`count(*) filter (where ${marketingAutomationRun.status} = 'active')::int`,
      converted: sql<number>`count(*) filter (where ${marketingAutomationRun.status} = 'converted')::int`,
      nextDue: sql<
        string | null
      >`min(${marketingAutomationRun.nextAt}) filter (where ${marketingAutomationRun.status} = 'active')`,
    })
    .from(marketingAutomationRun)
    .where(inArray(marketingAutomationRun.automationId, ids))
    .groupBy(marketingAutomationRun.automationId)
  const engine = await tx
    .select({
      id: automationRun.workflowId,
      runs: sql<number>`count(*)::int`,
      open: sql<number>`count(*) filter (where ${automationRun.status} in ('queued','running','waiting'))::int`,
      converted: sql<number>`count(*) filter (where ${automationRun.status} = 'converted')::int`,
      nextDue: sql<
        string | null
      >`min(${automationRun.nextAt}) filter (where ${automationRun.status} in ('queued','waiting'))`,
    })
    .from(automationRun)
    .where(and(inArray(automationRun.workflowId, ids), eq(automationRun.storeId, storeId)))
    .groupBy(automationRun.workflowId)
  const iso = (v: string | Date | null | undefined) => (v ? new Date(v).toISOString() : null)
  return ids.map((id) => {
    const l = legacy.find((r) => r.id === id)
    const e = engine.find((r) => r.id === id)
    const lv = {
      runs: l?.runs ?? 0,
      active: l?.active ?? 0,
      converted: l?.converted ?? 0,
      nextDue: iso(l?.nextDue),
    }
    const ev = {
      runs: e?.runs ?? 0,
      open: e?.open ?? 0,
      converted: e?.converted ?? 0,
      nextDue: iso(e?.nextDue),
    }
    return {
      workflowId: id,
      legacy: lv,
      engine: ev,
      ok:
        lv.runs === ev.runs &&
        lv.active === ev.open &&
        lv.converted === ev.converted &&
        lv.nextDue === ev.nextDue,
    }
  })
}
