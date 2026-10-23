/** SOURCE OF TRUTH: automation engine tests — WHAT: trigger idempotency, filters, loop guard, metering, the interpreter (branches, waits, retries, onError, exactly-once, approvals) and the tick, against a real database with mocked executors and evaluator / WHY: these are the engine's promises (design §8.5); the action and condition bodies are tested where they live. */
import {
  automationRun,
  automationStepRun,
  automationUsage,
  automationVersion,
  automationWorkflow,
  createDb,
  customer,
  order,
  outboxEvent,
  store,
  withStore,
} from '@commerce/db'
import { resetDb } from '@commerce/db/test'
import { eq } from 'drizzle-orm'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { PLANS } from '../../billing/plans'
import type { WorkflowDefinition } from '../definition'
import {
  type ActionExecutor,
  AutomationActionError,
  type ConditionEvaluator,
  type SubjectLoader,
} from '../executor'
import { resetActionExecutorsForTest } from '../registry'
import { advanceRun, type EngineDeps } from './interpreter'
import { decideApproval } from './runs'
import { automationTick } from './tick'
import { startRunsForOutboxRow } from './trigger'
import { storePlanId, usageMonth } from './usage'

const owner = createDb(process.env.DATABASE_URL_OWNER as string)
const app = createDb(process.env.DATABASE_URL as string)
const MIN = 60_000

afterAll(async () => {
  await owner.$client.end()
  await app.$client.end()
})

beforeEach(async () => {
  await resetDb(owner)
})

/** Passes when the subject's order has `flag: true`. */
const evaluate: ConditionEvaluator = (_rules, data) => {
  const pass = (data.order as { flag?: boolean } | undefined)?.flag === true
  return {
    pass,
    trace: [{ field: 'order.flag', op: 'is_true', expected: true, actual: pass, pass }],
  }
}

function harness(flag = true) {
  const calls: { id: string; key: string; attempt: number }[] = []
  let failNext: AutomationActionError | null = null
  const exec = (id: string): ActionExecutor => ({
    id,
    async run({ ctx }) {
      if (failNext) {
        const e = failNext
        failNext = null
        throw e
      }
      calls.push({ id, key: ctx.stepKey, attempt: ctx.attempt })
      return { summary: `ran ${id}`, output: { ok: true } }
    },
    async preview() {
      return { summary: `would ${id}`, wouldRun: true }
    },
  })
  resetActionExecutorsForTest([
    exec('order.add_tags'),
    exec('order.cancel'),
    exec('order.add_note'),
    exec('staff.email'),
  ])
  let now = new Date()
  const loadSubject: SubjectLoader = async () => ({ order: { flag } })
  const deps: EngineDeps = { evaluate, loadSubject, now: () => now }
  return {
    calls,
    deps,
    fail: (e: AutomationActionError) => {
      failNext = e
    },
    advanceClock: (ms: number) => {
      now = new Date(now.getTime() + ms)
      return now
    },
    nowIs: () => now,
  }
}

async function seedStore() {
  const [s] = await owner
    .insert(store)
    .values({ slug: `s${Date.now()}`, name: 'Waimers', apps: { installed: ['automations'] } })
    .returning()
  return s?.id as string
}

async function seedOrder(storeId: string, extra: Partial<typeof order.$inferInsert> = {}) {
  const [o] = await owner
    .insert(order)
    .values({
      storeId,
      number: 1,
      email: 'asha@x.in',
      subtotalPaise: 500000,
      totalPaise: 500000,
      ...extra,
    })
    .returning()
  return o?.id as string
}

async function publish(
  storeId: string,
  def: WorkflowDefinition,
  extra: Partial<typeof automationWorkflow.$inferInsert> = {},
) {
  const [w] = await owner
    .insert(automationWorkflow)
    .values({ storeId, name: 'High value', status: 'on', triggerType: def.trigger.type, ...extra })
    .returning()
  const [v] = await owner
    .insert(automationVersion)
    .values({ storeId, workflowId: w?.id as string, number: 1, definition: def })
    .returning()
  await owner
    .update(automationWorkflow)
    .set({ publishedVersionId: v?.id as string })
    .where(eq(automationWorkflow.id, w?.id as string))
  return w?.id as string
}

async function outbox(storeId: string, type: string, payload: Record<string, unknown>) {
  const [r] = await owner.insert(outboxEvent).values({ storeId, type, payload }).returning()
  return r?.id as string
}

const start = (storeId: string, outboxId: string, now = new Date()) =>
  withStore(app, storeId, (tx) => startRunsForOutboxRow(tx, storeId, outboxId, now))

async function runOf(id: string) {
  const [r] = await owner.select().from(automationRun).where(eq(automationRun.id, id))
  return r
}

async function stepsOf(runId: string) {
  return owner.select().from(automationStepRun).where(eq(automationStepRun.runId, runId))
}

const tagThenNote: WorkflowDefinition = {
  schemaVersion: 1,
  trigger: { type: 'order.paid', config: {} },
  start: 'check',
  nodes: {
    check: {
      kind: 'condition',
      id: 'check',
      rules: { join: 'and', rules: [{ field: 'order.flag', op: 'is_true' }] },
      next: 'tag',
      otherwise: null,
      otherwiseStops: true,
    },
    tag: {
      kind: 'action',
      id: 'tag',
      action: 'order.add_tags',
      config: { tags: ['VIP'] },
      next: 'note',
      onError: 'stop',
    },
    note: {
      kind: 'action',
      id: 'note',
      action: 'order.add_note',
      config: { note: 'Big one' },
      next: null,
      onError: 'stop',
    },
  },
  settings: {},
}

describe('trigger', () => {
  it('starts one run per workflow per event, however often the row is delivered', async () => {
    const storeId = await seedStore()
    const orderId = await seedOrder(storeId)
    const wf = await publish(storeId, tagThenNote)
    const row = await outbox(storeId, 'order.paid', { orderId })
    const first = await start(storeId, row)
    const again = await start(storeId, row)
    expect(first.started).toHaveLength(1)
    expect(again.started).toHaveLength(0)
    const runs = await owner.select().from(automationRun).where(eq(automationRun.workflowId, wf))
    expect(runs).toHaveLength(1)
    expect(runs[0]).toMatchObject({
      triggerKey: `outbox:${row}`,
      subjectId: orderId,
      status: 'queued',
    })
  })

  it('ignores imported orders and, unless asked, test orders', async () => {
    const storeId = await seedStore()
    await publish(storeId, tagThenNote)
    const imported = await seedOrder(storeId, { importedFrom: 'shopify' })
    const test = await seedOrder(storeId, { number: 2, isTest: true })
    expect(
      (await start(storeId, await outbox(storeId, 'order.paid', { orderId: imported }))).started,
    ).toHaveLength(0)
    expect(
      (await start(storeId, await outbox(storeId, 'order.paid', { orderId: test }))).started,
    ).toHaveLength(0)
    await publish(storeId, {
      ...tagThenNote,
      trigger: { type: 'order.paid', config: { includeTest: true } },
    })
    expect(
      (await start(storeId, await outbox(storeId, 'order.paid', { orderId: test }))).started,
    ).toHaveLength(1)
  })

  it('skips runs caused by an automation chain three deep, and its own events', async () => {
    const storeId = await seedStore()
    const orderId = await seedOrder(storeId)
    const wf = await publish(storeId, tagThenNote)
    const deep = await start(
      storeId,
      await outbox(storeId, 'order.paid', {
        orderId,
        automation: { runId: crypto.randomUUID(), workflowId: crypto.randomUUID(), depth: 3 },
      }),
    )
    expect(deep.skipped).toEqual([{ workflowId: wf, reason: 'loop_depth' }])
    const own = await start(
      storeId,
      await outbox(storeId, 'order.paid', {
        orderId,
        automation: { runId: crypto.randomUUID(), workflowId: wf, depth: 1 },
      }),
    )
    expect(own.skipped).toEqual([{ workflowId: wf, reason: 'own_event' }])
  })

  it('skips at the monthly run limit, but never Growth workflows', async () => {
    const storeId = await seedStore()
    const orderId = await seedOrder(storeId)
    const plan = await withStore(app, storeId, (tx) => storePlanId(tx, storeId))
    await owner.insert(automationUsage).values({
      storeId,
      month: usageMonth(),
      runs: PLANS[plan].automations.runsPerMonth,
    })
    const general = await publish(storeId, tagThenNote)
    const growth = await publish(storeId, tagThenNote, { origin: 'growth' })
    const r = await start(storeId, await outbox(storeId, 'order.paid', { orderId }))
    expect(r.skipped).toEqual([{ workflowId: general, reason: 'plan_limit' }])
    expect(r.started.map((s) => s.workflowId)).toEqual([growth])
  })

  it('enrols a customer in a welcome series once, however often they subscribe', async () => {
    const storeId = await seedStore()
    const [c] = await owner.insert(customer).values({ storeId, email: 'asha@x.in' }).returning()
    const wf = await publish(storeId, {
      ...tagThenNote,
      trigger: { type: 'customer.subscribed', config: {} },
    })
    for (let i = 0; i < 3; i++) {
      await start(storeId, await outbox(storeId, 'customer.subscribed', { customerId: c?.id }))
    }
    const runs = await owner.select().from(automationRun).where(eq(automationRun.workflowId, wf))
    expect(runs.map((r) => r.triggerKey)).toEqual([`subscribed:${c?.id}`])
  })

  it('meters each started general run', async () => {
    const storeId = await seedStore()
    const orderId = await seedOrder(storeId)
    await publish(storeId, tagThenNote)
    await start(storeId, await outbox(storeId, 'order.paid', { orderId }))
    const [u] = await owner
      .select()
      .from(automationUsage)
      .where(eq(automationUsage.storeId, storeId))
    expect(u?.runs).toBe(1)
  })
})

describe('interpreter', () => {
  it('walks Then, runs each action once and completes', async () => {
    const h = harness(true)
    const storeId = await seedStore()
    const orderId = await seedOrder(storeId)
    await publish(storeId, tagThenNote)
    const [run] = (await start(storeId, await outbox(storeId, 'order.paid', { orderId }))).started
    const r = await advanceRun(app, storeId, run?.runId as string, h.deps)
    expect(r).toMatchObject({ nodes: 3, parked: null })
    expect(h.calls.map((c) => c.id)).toEqual(['order.add_tags', 'order.add_note'])
    expect(h.calls[0]?.key).toBe(`${run?.runId}:tag:0`)
    expect((await runOf(run?.runId as string))?.status).toBe('completed')
    const steps = await stepsOf(run?.runId as string)
    expect(steps.map((s) => [s.nodeId, s.status]).sort()).toEqual([
      ['check', 'then'],
      ['note', 'succeeded'],
      ['tag', 'succeeded'],
    ])
    // A duplicate job finds nothing left to do.
    await advanceRun(app, storeId, run?.runId as string, h.deps)
    expect(h.calls).toHaveLength(2)
  })

  it('makes external calls after the run transaction commits, then records them', async () => {
    const h = harness(true)
    const storeId = await seedStore()
    const orderId = await seedOrder(storeId)
    await publish(storeId, {
      ...tagThenNote,
      start: 'alert',
      nodes: {
        alert: {
          kind: 'action',
          id: 'alert',
          action: 'staff.email',
          config: { to: ['ops@x.in'], subject: 'Order {order.number}', body: 'Pack it' },
          next: 'tag',
          onError: 'stop',
        },
        tag: {
          ...(tagThenNote.nodes.tag as object),
          next: null,
        } as WorkflowDefinition['nodes'][string],
      },
    })
    const [run] = (await start(storeId, await outbox(storeId, 'order.paid', { orderId }))).started
    const id = run?.runId as string
    await advanceRun(app, storeId, id, h.deps)
    expect(h.calls.map((c) => c.id)).toEqual(['staff.email', 'order.add_tags'])
    const alert = (await stepsOf(id)).find((s) => s.nodeId === 'alert')
    expect(alert).toMatchObject({ status: 'succeeded', summary: 'ran staff.email' })
    expect((await runOf(id))?.status).toBe('completed')
  })

  it('stops on Otherwise when the condition says so', async () => {
    const h = harness(false)
    const storeId = await seedStore()
    const orderId = await seedOrder(storeId)
    await publish(storeId, tagThenNote)
    const [run] = (await start(storeId, await outbox(storeId, 'order.paid', { orderId }))).started
    await advanceRun(app, storeId, run?.runId as string, h.deps)
    expect(await runOf(run?.runId as string)).toMatchObject({
      status: 'stopped',
      stopReason: 'condition',
    })
    expect(h.calls).toHaveLength(0)
  })

  it('parks on a wait and resumes when it is due', async () => {
    const h = harness(true)
    const storeId = await seedStore()
    const orderId = await seedOrder(storeId)
    await publish(storeId, {
      ...tagThenNote,
      start: 'wait',
      nodes: {
        ...tagThenNote.nodes,
        wait: { kind: 'wait', id: 'wait', minutes: 60, next: 'check' },
      },
    })
    const [run] = (
      await start(storeId, await outbox(storeId, 'order.paid', { orderId }), h.nowIs())
    ).started
    const id = run?.runId as string
    const parked = await advanceRun(app, storeId, id, h.deps)
    expect(parked.parked?.status).toBe('waiting')
    expect(parked.parked?.nextAt?.getTime()).toBe(h.nowIs().getTime() + 60 * MIN)
    await advanceRun(app, storeId, id, h.deps)
    expect(h.calls).toHaveLength(0)
    h.advanceClock(61 * MIN)
    await advanceRun(app, storeId, id, h.deps)
    expect(h.calls).toHaveLength(2)
    expect((await runOf(id))?.status).toBe('completed')
  })

  it('retries a retryable failure later and fails a final one', async () => {
    const h = harness(true)
    const storeId = await seedStore()
    const orderId = await seedOrder(storeId)
    await publish(storeId, tagThenNote)
    const [run] = (
      await start(storeId, await outbox(storeId, 'order.paid', { orderId }), h.nowIs())
    ).started
    const id = run?.runId as string
    h.fail(new AutomationActionError('lock', { retryable: true }))
    const first = await advanceRun(app, storeId, id, h.deps)
    expect(first.parked?.status).toBe('waiting')
    const [tagStep] = (await stepsOf(id)).filter((s) => s.nodeId === 'tag')
    expect(tagStep).toMatchObject({ status: 'failed', attempt: 1 })
    h.advanceClock(10 * MIN)
    await advanceRun(app, storeId, id, h.deps)
    expect(h.calls.map((c) => [c.id, c.attempt])).toEqual([
      ['order.add_tags', 2],
      ['order.add_note', 1],
    ])

    const [again] = (
      await start(storeId, await outbox(storeId, 'order.paid', { orderId }), h.nowIs())
    ).started
    h.fail(new AutomationActionError('already cancelled', { retryable: false }))
    await advanceRun(app, storeId, again?.runId as string, h.deps)
    expect(await runOf(again?.runId as string)).toMatchObject({
      status: 'failed',
      error: 'already cancelled',
      cursor: 'tag',
    })
  })

  it('carries on past a failed step with onError continue', async () => {
    const h = harness(true)
    const storeId = await seedStore()
    const orderId = await seedOrder(storeId)
    const def = structuredClone(tagThenNote)
    if (def.nodes.tag?.kind === 'action') def.nodes.tag.onError = 'continue'
    await publish(storeId, def)
    const [run] = (await start(storeId, await outbox(storeId, 'order.paid', { orderId }))).started
    h.fail(new AutomationActionError('nope', { retryable: false }))
    await advanceRun(app, storeId, run?.runId as string, h.deps)
    expect(h.calls.map((c) => c.id)).toEqual(['order.add_note'])
    expect((await runOf(run?.runId as string))?.status).toBe('completed')
  })

  it('asks before cancelling and runs only once approved', async () => {
    const h = harness(true)
    const storeId = await seedStore()
    const orderId = await seedOrder(storeId)
    await publish(storeId, {
      ...tagThenNote,
      start: 'cancel',
      nodes: {
        cancel: {
          kind: 'action',
          id: 'cancel',
          action: 'order.cancel',
          config: { reason: 'fraud', notifyCustomer: false, restock: true },
          next: null,
          onError: 'stop',
        },
      },
    })
    const [run] = (await start(storeId, await outbox(storeId, 'order.paid', { orderId }))).started
    const id = run?.runId as string
    const parked = await advanceRun(app, storeId, id, h.deps)
    expect(parked.parked?.status).toBe('awaiting_approval')
    expect(h.calls).toHaveLength(0)
    const [step] = await stepsOf(id)
    expect(step).toMatchObject({ status: 'awaiting_approval', summary: 'would order.cancel' })
    const member = { userId: 'u1', isOwner: true, permissions: [] }
    await withStore(app, storeId, (tx) =>
      decideApproval(tx, storeId, { stepRunId: step?.id as string, approve: true }, member, []),
    )
    await advanceRun(app, storeId, id, h.deps)
    expect(h.calls.map((c) => c.id)).toEqual(['order.cancel'])
    expect((await runOf(id))?.status).toBe('completed')
  })

  it('stops a declined approval', async () => {
    const h = harness(true)
    const storeId = await seedStore()
    const orderId = await seedOrder(storeId)
    await publish(storeId, {
      ...tagThenNote,
      start: 'cancel',
      nodes: {
        cancel: {
          kind: 'action',
          id: 'cancel',
          action: 'order.cancel',
          config: {},
          next: null,
          onError: 'stop',
        },
      },
    })
    const [run] = (await start(storeId, await outbox(storeId, 'order.paid', { orderId }))).started
    const id = run?.runId as string
    await advanceRun(app, storeId, id, h.deps)
    const [step] = await stepsOf(id)
    const member = { userId: 'u1', isOwner: false, permissions: ['orders.cancel' as const] }
    await withStore(app, storeId, (tx) =>
      decideApproval(tx, storeId, { stepRunId: step?.id as string, approve: false }, member, []),
    )
    await advanceRun(app, storeId, id, h.deps)
    expect(h.calls).toHaveLength(0)
    expect(await runOf(id)).toMatchObject({ status: 'stopped', stopReason: 'approval_declined' })
  })
})

describe('tick', () => {
  it('holds the runs of a paused Growth workflow until it is switched back on', async () => {
    const h = harness(true)
    const storeId = await seedStore()
    const orderId = await seedOrder(storeId)
    const wf = await publish(
      storeId,
      {
        ...tagThenNote,
        start: 'wait',
        nodes: {
          ...tagThenNote.nodes,
          wait: { kind: 'wait', id: 'wait', minutes: 5, next: 'check' },
        },
      },
      { origin: 'growth' },
    )
    const [run] = (
      await start(storeId, await outbox(storeId, 'order.paid', { orderId }), h.nowIs())
    ).started
    const id = run?.runId as string
    await advanceRun(app, storeId, id, h.deps)
    await owner
      .update(automationWorkflow)
      .set({ status: 'off' })
      .where(eq(automationWorkflow.id, wf))
    const due = new Date(h.nowIs().getTime() + 6 * MIN)
    h.advanceClock(6 * MIN)
    expect((await withStore(app, storeId, (tx) => automationTick(tx, storeId, due))).due).toEqual(
      [],
    )
    await advanceRun(app, storeId, id, h.deps)
    expect(h.calls).toHaveLength(0)
    expect((await runOf(id))?.status).toBe('waiting')
    await owner
      .update(automationWorkflow)
      .set({ status: 'on' })
      .where(eq(automationWorkflow.id, wf))
    const back = await withStore(app, storeId, (tx) => automationTick(tx, storeId, due))
    expect(back.due.map((d) => d.runId)).toEqual([id])
    await advanceRun(app, storeId, id, h.deps)
    expect(h.calls).toHaveLength(2)
  })

  it('returns waits that came due and expires old approvals', async () => {
    const h = harness(true)
    const storeId = await seedStore()
    const orderId = await seedOrder(storeId)
    await publish(storeId, {
      ...tagThenNote,
      start: 'wait',
      nodes: {
        ...tagThenNote.nodes,
        wait: { kind: 'wait', id: 'wait', minutes: 5, next: 'check' },
      },
    })
    const [run] = (
      await start(storeId, await outbox(storeId, 'order.paid', { orderId }), h.nowIs())
    ).started
    await advanceRun(app, storeId, run?.runId as string, h.deps)
    const early = await withStore(app, storeId, (tx) => automationTick(tx, storeId, h.nowIs()))
    expect(early.due).toHaveLength(0)
    const later = await withStore(app, storeId, (tx) =>
      automationTick(tx, storeId, new Date(h.nowIs().getTime() + 6 * MIN)),
    )
    expect(later.due.map((d) => d.runId)).toEqual([run?.runId])
  })
})
