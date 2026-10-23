/** SOURCE OF TRUTH: Automations housekeeping tests — WHAT: owner notices are claimed once (80%, 100%, switched off), the prune keeps open runs and recent detail, and uninstalling an app switches off only the workflows that use it / WHY: these run unattended on every store. */
import {
  automationRun,
  automationStepRun,
  automationUsage,
  automationVersion,
  automationWorkflow,
  createDb,
  store,
  withStore,
} from '@commerce/db'
import { resetDb } from '@commerce/db/test'
import { eq } from 'drizzle-orm'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { PLANS } from '../../billing/plans'
import type { WorkflowDefinition } from '../definition'
import { claimOwnerNotices, onAppUninstalled, pruneAutomationHistory } from './notices'
import { storePlanId, usageMonth } from './usage'

const owner = createDb(process.env.DATABASE_URL_OWNER as string)
const app = createDb(process.env.DATABASE_URL as string)

afterAll(async () => {
  await owner.$client.end()
  await app.$client.end()
})

beforeEach(async () => {
  await resetDb(owner)
})

async function seedStore() {
  const [s] = await owner
    .insert(store)
    .values({ slug: `n${Date.now()}`, name: 'Waimers', apps: { installed: ['automations'] } })
    .returning()
  return s?.id as string
}

const def = (trigger: string, action: string): WorkflowDefinition => ({
  schemaVersion: 1,
  trigger: { type: trigger, config: {} },
  start: 'a',
  nodes: {
    a: { kind: 'action', id: 'a', action, config: {}, next: null, onError: 'stop' },
  },
  settings: {},
})

async function workflow(
  storeId: string,
  d: WorkflowDefinition,
  extra: Partial<typeof automationWorkflow.$inferInsert> = {},
) {
  const [w] = await owner
    .insert(automationWorkflow)
    .values({ storeId, name: 'W', status: 'on', triggerType: d.trigger.type, ...extra })
    .returning()
  const [v] = await owner
    .insert(automationVersion)
    .values({ storeId, workflowId: w?.id as string, number: 1, definition: d })
    .returning()
  await owner
    .update(automationWorkflow)
    .set({ publishedVersionId: v?.id as string })
    .where(eq(automationWorkflow.id, w?.id as string))
  return { workflowId: w?.id as string, versionId: v?.id as string }
}

const claim = (storeId: string) => withStore(app, storeId, (tx) => claimOwnerNotices(tx, storeId))

describe('owner notices', () => {
  it('warns once at 80% and once at the limit', async () => {
    const storeId = await seedStore()
    const plan = await withStore(app, storeId, (tx) => storePlanId(tx, storeId))
    const limit = PLANS[plan].automations.runsPerMonth
    await owner
      .insert(automationUsage)
      .values({ storeId, month: usageMonth(), runs: Math.ceil(limit * 0.8) })
    expect((await claim(storeId)).map((n) => n.subject)).toEqual([
      'Your automations have used 80% of this month’s runs',
    ])
    expect(await claim(storeId)).toEqual([])
    await owner
      .update(automationUsage)
      .set({ runs: limit })
      .where(eq(automationUsage.storeId, storeId))
    expect(await claim(storeId)).toHaveLength(1)
    expect(await claim(storeId)).toEqual([])
  })

  it('tells the owner once when a workflow is switched off for a problem', async () => {
    const storeId = await seedStore()
    await workflow(storeId, def('order.paid', 'order.add_tags'), {
      status: 'off',
      name: 'VIP',
      problem: 'Switched off: it ran more than 50 times in an hour on one record',
    })
    expect((await claim(storeId)).map((n) => n.subject)).toEqual(['Automation switched off: VIP'])
    expect(await claim(storeId)).toEqual([])
  })
})

describe('prune', () => {
  it('drops old step detail and old finished runs, never open ones', async () => {
    const storeId = await seedStore()
    const { workflowId, versionId } = await workflow(storeId, def('order.paid', 'order.add_tags'))
    const old = new Date(Date.now() - 400 * 86_400_000)
    const base = { storeId, workflowId, versionId, triggerType: 'order.paid', subjectType: 'none' }
    const [done] = await owner
      .insert(automationRun)
      .values({ ...base, triggerKey: 'a', status: 'completed', startedAt: old })
      .returning()
    const [waiting] = await owner
      .insert(automationRun)
      .values({ ...base, triggerKey: 'b', status: 'waiting', startedAt: old })
      .returning()
    await owner.insert(automationStepRun).values({
      storeId,
      runId: waiting?.id as string,
      nodeId: 'a',
      kind: 'action',
      status: 'succeeded',
      startedAt: old,
    })
    const r = await withStore(app, storeId, (tx) => pruneAutomationHistory(tx))
    expect(r).toEqual({ steps: 1, runs: 1 })
    const left = await owner.select({ id: automationRun.id }).from(automationRun)
    expect(left.map((x) => x.id)).toEqual([waiting?.id])
    expect(done).toBeDefined()
  })
})

describe('app uninstall', () => {
  it('switches off the workflows that use the app, and only those', async () => {
    const storeId = await seedStore()
    const uses = await workflow(storeId, def('order.paid', 'meta/send_lead'))
    const triggered = await workflow(storeId, def('meta/lead_received', 'order.add_tags'))
    const other = await workflow(storeId, def('order.paid', 'order.add_tags'))
    const r = await withStore(app, storeId, (tx) => onAppUninstalled(tx, storeId, 'meta'))
    expect(r.switchedOff).toBe(2)
    const rows = await owner
      .select({ id: automationWorkflow.id, status: automationWorkflow.status })
      .from(automationWorkflow)
    const status = new Map(rows.map((x) => [x.id, x.status]))
    expect(status.get(uses.workflowId)).toBe('off')
    expect(status.get(triggered.workflowId)).toBe('off')
    expect(status.get(other.workflowId)).toBe('on')
  })
})
