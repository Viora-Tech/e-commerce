/** SOURCE OF TRUTH: "Remind unpaid orders" end to end — WHAT: the built-in template published on a store, fired by the scheduler tick and walked by the interpreter with the real condition evaluator, loaders and executors: exactly the unpaid non-COD orders older than 3 days get one queued payment reminder, and the next day's run queues nothing new / WHY: Find records + For each + the scheduler + the order-update step working together, on a real database. */
import {
  automationRun,
  automationVersion,
  automationWorkflow,
  createDb,
  order,
  outboxEvent,
  store,
  withStore,
} from '@commerce/db'
import { resetDb } from '@commerce/db/test'
import { NotificationRegistry } from '@commerce/notifications'
import { and, eq } from 'drizzle-orm'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { registerBuiltinActions } from '../actions'
import { evaluateRules, loadSubjectData } from '../conditions'
import { builtinTemplate } from '../templates'
import { advanceRun, type EngineDeps } from './interpreter'
import { automationTick } from './tick'

const owner = createDb(process.env.DATABASE_URL_OWNER as string)
const app = createDb(process.env.DATABASE_URL as string)
const DAY = 86_400_000

beforeAll(() => {
  registerBuiltinActions({
    settingsSecret: 'test-secret-test-secret-test-secret-1234',
    storefrontUrl: 'https://shop.test',
    registry: new NotificationRegistry(),
  })
})

afterAll(async () => {
  await owner.$client.end()
  await app.$client.end()
})

beforeEach(async () => {
  await resetDb(owner)
})

const deps: EngineDeps = { evaluate: evaluateRules, loadSubject: loadSubjectData }

async function seed() {
  const [s] = await owner
    .insert(store)
    .values({ slug: `r${Date.now()}`, name: 'Waimers', apps: { installed: ['automations'] } })
    .returning()
  const storeId = s?.id as string
  const now = Date.now()
  const make = async (
    number: number,
    extra: { paymentStatus: 'unpaid' | 'paid'; paymentMethod: string; ageDays: number },
  ) => {
    const [o] = await owner
      .insert(order)
      .values({
        storeId,
        number,
        email: `buyer${number}@x.in`,
        subtotalPaise: 100000,
        totalPaise: 100000,
        status: 'open',
        paymentStatus: extra.paymentStatus,
        paymentMethod: extra.paymentMethod,
        placedAt: new Date(now - extra.ageDays * DAY),
      })
      .returning()
    return o?.id as string
  }
  const ids = {
    unpaidOld: await make(1, { paymentStatus: 'unpaid', paymentMethod: 'upi', ageDays: 5 }),
    unpaidOld2: await make(2, { paymentStatus: 'unpaid', paymentMethod: 'bank', ageDays: 4 }),
    unpaidNew: await make(3, { paymentStatus: 'unpaid', paymentMethod: 'upi', ageDays: 1 }),
    cod: await make(4, { paymentStatus: 'unpaid', paymentMethod: 'cod', ageDays: 5 }),
    paid: await make(5, { paymentStatus: 'paid', paymentMethod: 'upi', ageDays: 5 }),
  }
  const tpl = builtinTemplate('remind-unpaid-orders')
  if (!tpl) throw new Error('template missing')
  const [w] = await owner
    .insert(automationWorkflow)
    .values({ storeId, name: 'Remind unpaid orders', status: 'on', triggerType: 'schedule' })
    .returning()
  const [v] = await owner
    .insert(automationVersion)
    .values({ storeId, workflowId: w?.id as string, number: 1, definition: tpl.definition })
    .returning()
  await owner
    .update(automationWorkflow)
    .set({ publishedVersionId: v?.id as string })
    .where(eq(automationWorkflow.id, w?.id as string))
  return { storeId, workflowId: w?.id as string, ids }
}

/** One scheduler fire at `at`: the tick starts the run, the step job walks it. */
async function fire(storeId: string, workflowId: string, at: Date) {
  await owner
    .update(automationWorkflow)
    .set({ nextFireAt: new Date(at.getTime() - 60_000) })
    .where(eq(automationWorkflow.id, workflowId))
  const tick = await withStore(app, storeId, (tx) => automationTick(tx, storeId, at))
  expect(tick.scheduled).toHaveLength(1)
  const runId = tick.scheduled[0]?.runId as string
  await advanceRun(app, storeId, runId, deps)
  const [run] = await owner.select().from(automationRun).where(eq(automationRun.id, runId))
  return run
}

async function queuedReminders() {
  const rows = await owner
    .select({ payload: outboxEvent.payload })
    .from(outboxEvent)
    .where(and(eq(outboxEvent.type, 'automation.order_update')))
  return rows.map((r) => r.payload as { orderId: string; notificationTemplate: string })
}

describe('Remind unpaid orders', () => {
  it('queues one reminder per unpaid non-COD order older than 3 days, and nothing new the next day', async () => {
    const { storeId, workflowId, ids } = await seed()

    const first = await fire(storeId, workflowId, new Date())
    expect(first).toMatchObject({ status: 'completed', loop: null })
    const queued = await queuedReminders()
    expect(queued.map((q) => q.orderId).sort()).toEqual([ids.unpaidOld, ids.unpaidOld2].sort())
    expect(queued.every((q) => q.notificationTemplate === 'payment_reminder')).toBe(true)

    const second = await fire(storeId, workflowId, new Date(Date.now() + DAY))
    expect(second?.status).toBe('completed')
    expect(await queuedReminders()).toHaveLength(2)
  })
})
