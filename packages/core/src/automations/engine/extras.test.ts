/** SOURCE OF TRUTH: Automations housekeeping tests — WHAT: owner alerts at 80% / 100% of monthly runs and on a circuit-breaker switch-off (once each, emailed through the store's channel), the retention prune, and pausing workflows when their app is uninstalled / WHY: these run unattended, so a double email or a lost run log would go unseen. */
import {
  automationRun,
  automationStepRun,
  automationUsage,
  automationVersion,
  automationWorkflow,
  createDb,
  notification,
  outboxEvent,
  type StoreTx,
  store,
  withStore,
} from '@commerce/db'
import { resetDb } from '@commerce/db/test'
import type { MarketingSend, NotificationChannel } from '@commerce/notifications'
import { eq } from 'drizzle-orm'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { pauseWorkflowsForRemovedApp, pruneAutomationRuns } from './maintenance'
import { deliverOwnerAlertRow } from './owner-alerts'
import { switchOffWithProblem } from './trigger'
import { meterRun, usageMonth } from './usage'

const owner = createDb(process.env.DATABASE_URL_OWNER as string)
const app = createDb(process.env.DATABASE_URL as string)

beforeEach(async () => {
  await resetDb(owner)
})
afterAll(async () => {
  await owner.$client.end()
  await app.$client.end()
})

async function newStore() {
  const [s] = await owner
    .insert(store)
    .values({ slug: 'extras', name: 'Chai Co', contactEmail: 'owner@chai.example' })
    .returning()
  return s?.id as string
}

async function workflow(
  tx: StoreTx,
  storeId: string,
  definition: Record<string, unknown> = { trigger: { type: 'order.paid', config: {} }, nodes: {} },
  status: 'on' | 'off' = 'on',
) {
  const [w] = await tx
    .insert(automationWorkflow)
    .values({ storeId, name: 'Tag VIPs', triggerType: 'order.paid', status })
    .returning()
  const [v] = await tx
    .insert(automationVersion)
    .values({ storeId, workflowId: w?.id as string, number: 1, definition })
    .returning()
  await tx
    .update(automationWorkflow)
    .set({ publishedVersionId: v?.id })
    .where(eq(automationWorkflow.id, w?.id as string))
  return { id: w?.id as string, versionId: v?.id as string }
}

const alerts = (tx: StoreTx) =>
  tx.select().from(outboxEvent).where(eq(outboxEvent.type, 'automation.owner_alert'))

describe('owner alerts', () => {
  it('alerts once at 80% and once at the limit each month', async () => {
    const storeId = await newStore()
    await withStore(app, storeId, async (tx) => {
      const month = usageMonth()
      await tx.insert(automationUsage).values({ storeId, month, runs: 1_598 })
      await meterRun(tx, storeId, 'starter')
      expect(await alerts(tx)).toHaveLength(0)
      await meterRun(tx, storeId, 'starter') // 1,600 of 2,000
      await meterRun(tx, storeId, 'starter')
      const at80 = await alerts(tx)
      expect(at80.map((a) => a.payload)).toEqual([
        { ownerAlert: { kind: 'usage_80', runs: 1_600, limit: 2_000 } },
      ])
      await tx.update(automationUsage).set({ runs: 1_999 })
      await meterRun(tx, storeId, 'starter') // 2,000: the limit
      const refused = await meterRun(tx, storeId, 'starter')
      expect(refused.ok).toBe(false)
      const kinds = (await alerts(tx)).map(
        (a) => (a.payload as { ownerAlert: { kind: string } }).ownerAlert.kind,
      )
      expect(kinds.sort()).toEqual(['usage_100', 'usage_80'])
    })
  })

  it('alerts when the circuit breaker switches a workflow off, not when it was already off', async () => {
    const storeId = await newStore()
    await withStore(app, storeId, async (tx) => {
      const w = await workflow(tx, storeId)
      await switchOffWithProblem(tx, w.id, 'Switched off: it looped')
      await switchOffWithProblem(tx, w.id, 'Switched off: it looped')
      const rows = await alerts(tx)
      expect(rows).toHaveLength(1)
      expect(rows[0]?.payload).toMatchObject({
        ownerAlert: { kind: 'switched_off', workflowId: w.id },
      })
    })
  })

  it("emails the alert to the store's owners (here, its contact address) and logs it", async () => {
    const storeId = await newStore()
    const sent: MarketingSend[] = []
    const email: NotificationChannel = {
      id: 'ses',
      label: 'ses',
      requires: 'email',
      async send() {
        return { ok: true, providerRef: 'x' }
      },
      async sendMarketing(m) {
        sent.push(m)
        return { ok: true, providerRef: `ses-${sent.length}` }
      },
    }
    const outboxId = await withStore(app, storeId, async (tx) => {
      const w = await workflow(tx, storeId)
      await switchOffWithProblem(tx, w.id, 'Switched off: it looped')
      const [row] = await alerts(tx)
      return row?.id as string
    })
    const deps = {
      settingsSecret: 's',
      adminUrl: 'https://admin.example',
      registry: {} as never,
      channels: [email],
    }
    expect(await deliverOwnerAlertRow(app, { storeId, outboxId }, deps)).toBe(true)
    expect(sent).toHaveLength(1)
    expect(sent[0]).toMatchObject({
      kind: 'email',
      to: { email: 'owner@chai.example' },
      subject: 'Automations: "Tag VIPs" was switched off',
    })
    const logged = await withStore(app, storeId, (tx) => tx.select().from(notification))
    expect(logged).toMatchObject([{ template: 'automation_owner_alert', status: 'sent' }])
    // Any other outbox row is left for the trigger job.
    const other = await withStore(app, storeId, async (tx) => {
      const [row] = await tx
        .insert(outboxEvent)
        .values({ storeId, type: 'order.paid', payload: { orderId: crypto.randomUUID() } })
        .returning()
      return row?.id as string
    })
    expect(await deliverOwnerAlertRow(app, { storeId, outboxId: other }, deps)).toBe(false)
  })
})

describe('retention prune', () => {
  it('drops old step detail and old finished runs, never open runs or usage', async () => {
    const storeId = await newStore()
    const now = new Date('2026-10-23T00:00:00Z')
    const daysAgo = (d: number) => new Date(now.getTime() - d * 86_400_000)
    await withStore(app, storeId, async (tx) => {
      const w = await workflow(tx, storeId)
      const run = async (
        key: string,
        status: 'completed' | 'waiting',
        startedAt: Date,
        finishedAt: Date | null,
      ) => {
        const [r] = await tx
          .insert(automationRun)
          .values({
            storeId,
            workflowId: w.id,
            versionId: w.versionId,
            triggerType: 'order.paid',
            triggerKey: key,
            subjectType: 'order',
            status,
            startedAt,
            finishedAt,
          })
          .returning()
        await tx.insert(automationStepRun).values({
          storeId,
          runId: r?.id as string,
          nodeId: 'n1',
          kind: 'action',
          status: 'succeeded',
          startedAt,
        })
        return r?.id as string
      }
      const recent = await run('a', 'completed', daysAgo(10), daysAgo(10))
      const oldDetail = await run('b', 'completed', daysAgo(120), daysAgo(120))
      const ancient = await run('c', 'completed', daysAgo(500), daysAgo(500))
      const waiting = await run('d', 'waiting', daysAgo(200), null)
      await tx.insert(automationUsage).values({ storeId, month: '2025-01', runs: 9 })

      const r = await pruneAutomationRuns(tx, now)
      expect(r).toEqual({ steps: 2, runs: 1 })
      const runs = (await tx.select().from(automationRun)).map((x) => x.id).sort()
      expect(runs).toEqual([recent, oldDetail, waiting].sort())
      const steps = (await tx.select().from(automationStepRun)).map((x) => x.runId).sort()
      expect(steps).toEqual([recent, waiting].sort())
      expect(ancient).toBeTruthy()
      expect(await tx.select().from(automationUsage)).toHaveLength(1)
    })
  })
})

describe('uninstalling an app', () => {
  it('pauses the workflows that use its trigger or actions, with a note', async () => {
    const storeId = await newStore()
    await withStore(app, storeId, async (tx) => {
      const byTrigger = await workflow(tx, storeId, {
        trigger: { type: 'shopify/order_imported', config: {} },
        nodes: {},
      })
      const byAction = await workflow(tx, storeId, {
        trigger: { type: 'order.paid', config: {} },
        nodes: { a: { kind: 'action', id: 'a', action: 'shopify/sync_order', next: null } },
      })
      const other = await workflow(tx, storeId, {
        trigger: { type: 'order.paid', config: {} },
        nodes: { a: { kind: 'action', id: 'a', action: 'order.add_tags', next: null } },
      })
      const paused = await pauseWorkflowsForRemovedApp(tx, 'shopify', 'Shopify import')
      expect(paused.sort()).toEqual([byTrigger.id, byAction.id].sort())
      const rows = await tx.select().from(automationWorkflow)
      const get = (id: string) => rows.find((r) => r.id === id)
      expect(get(byTrigger.id)).toMatchObject({ status: 'off' })
      expect(get(byAction.id)?.problem).toContain('the Shopify import app was removed')
      expect(get(other.id)).toMatchObject({ status: 'on', problem: null })
      expect(await pauseWorkflowsForRemovedApp(tx, 'meta', 'Meta')).toEqual([])
    })
  })
})
