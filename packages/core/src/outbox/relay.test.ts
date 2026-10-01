import { createDb, outboxEvent, store, withStore } from '@commerce/db'
import { resetDb } from '@commerce/db/test'
import { definePlugin, loadPlugins } from '@commerce/plugins'
import { isNull } from 'drizzle-orm'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { corePlugin } from '../plugins/core-plugin'
import type { AppEventQueue } from '../plugins/events'
import { relayStoreOutbox } from './relay'
import { insertOutboxEvent } from './write'

const owner = createDb(process.env.DATABASE_URL_OWNER as string)
const app = createDb(process.env.DATABASE_URL as string)

beforeEach(async () => {
  await resetDb(owner)
})
afterAll(async () => {
  await owner.$client.end()
  await app.$client.end()
})

/** Two installed apps, both hooking `order.paid`; neither's hook ever runs from the relay. */
const appA = definePlugin({
  id: 'app-a',
  name: 'App A',
  version: '0.0.1',
  kind: 'builtin',
  provides: {},
  hooks: { 'order.paid': async () => {} },
})
const appB = definePlugin({
  id: 'app-b',
  name: 'App B',
  version: '0.0.1',
  kind: 'builtin',
  provides: {},
  hooks: { 'order.paid': async () => {} },
})
const plugins = loadPlugins([corePlugin, appA, appB])

function fakeQueue<T extends { storeId: string }>() {
  const calls: { name: string; data: T; jobId: string | undefined }[] = []
  const queue = {
    add: async (name: string, data: T, opts?: { jobId?: string }) => {
      calls.push({ name, data, jobId: opts?.jobId })
    },
  }
  return { queue, calls }
}

async function seedStore(slug: string, installed: string[] = []) {
  const [s] = await owner
    .insert(store)
    .values({ slug, name: slug, apps: { installed } })
    .returning()
  if (!s) throw new Error('seed')
  return s.id
}

describe('relayStoreOutbox', () => {
  it('fans an order.paid row out to one notification job and one job per installed app', async () => {
    const storeId = await seedStore('relay-fanout', ['app-a', 'app-b'])
    const orderId = crypto.randomUUID()
    await withStore(app, storeId, (tx) => insertOutboxEvent(tx, storeId, 'order.paid', { orderId }))

    const notifications = fakeQueue<{ storeId: string; orderId: string; template: string }>()
    const appEvents = fakeQueue<{ storeId: string; pluginId?: string }>()
    const outcome = await relayStoreOutbox(
      {
        db: app,
        plugins,
        notifications: notifications.queue,
        appEvents: appEvents.queue as AppEventQueue,
      },
      storeId,
    )

    expect(outcome).toEqual({ claimed: 1, dispatched: 1, failed: 0 })
    expect(notifications.calls).toHaveLength(1)
    expect(notifications.calls[0]?.data).toMatchObject({ orderId, template: 'payment_received' })
    // One job per installed app, not one job that would run both hooks.
    expect(appEvents.calls.map((c) => c.data.pluginId).sort()).toEqual(['app-a', 'app-b'])
    expect(new Set(appEvents.calls.map((c) => c.jobId)).size).toBe(2)

    const rows = await withStore(app, storeId, (tx) => tx.select().from(outboxEvent))
    expect(rows[0]?.dispatchedAt).not.toBeNull()
  })

  it('two concurrent relay ticks for the same store never double-dispatch a row', async () => {
    const storeId = await seedStore('relay-concurrent')
    for (let i = 0; i < 5; i += 1) {
      await withStore(app, storeId, (tx) =>
        insertOutboxEvent(tx, storeId, 'order.placed', { orderId: crypto.randomUUID() }),
      )
    }

    const notifications = fakeQueue<{ storeId: string; orderId: string; template: string }>()
    const deps = { db: app, plugins, notifications: notifications.queue }
    const [a, b] = await Promise.all([
      relayStoreOutbox(deps, storeId),
      relayStoreOutbox(deps, storeId),
    ])

    expect((a?.dispatched ?? 0) + (b?.dispatched ?? 0)).toBe(5)
    expect(notifications.calls).toHaveLength(5)
    const rows = await withStore(app, storeId, (tx) => tx.select().from(outboxEvent))
    expect(rows.every((r) => r.dispatchedAt !== null)).toBe(true)
  })

  it("only claims and dispatches the given store's rows", async () => {
    const storeA = await seedStore('relay-iso-a')
    const storeB = await seedStore('relay-iso-b')
    await withStore(app, storeA, (tx) =>
      insertOutboxEvent(tx, storeA, 'order.placed', { orderId: crypto.randomUUID() }),
    )
    await withStore(app, storeB, (tx) =>
      insertOutboxEvent(tx, storeB, 'order.placed', { orderId: crypto.randomUUID() }),
    )

    const notifications = fakeQueue<{ storeId: string; orderId: string; template: string }>()
    const deps = { db: app, plugins, notifications: notifications.queue }
    const outcome = await relayStoreOutbox(deps, storeA)

    expect(outcome).toEqual({ claimed: 1, dispatched: 1, failed: 0 })
    expect(notifications.calls).toHaveLength(1)
    expect(notifications.calls[0]?.data.storeId).toBe(storeA)

    const rowsB = await withStore(app, storeB, (tx) =>
      tx.select().from(outboxEvent).where(isNull(outboxEvent.dispatchedAt)),
    )
    expect(rowsB).toHaveLength(1)
  })

  it('a row with no matching consumer is marked dispatched with nothing enqueued', async () => {
    const storeId = await seedStore('relay-no-consumer')
    await withStore(app, storeId, (tx) =>
      insertOutboxEvent(tx, storeId, 'order.cancelled', { orderId: crypto.randomUUID() }),
    )
    const notifications = fakeQueue<{ storeId: string; orderId: string; template: string }>()
    const outcome = await relayStoreOutbox(
      { db: app, plugins, notifications: notifications.queue },
      storeId,
    )
    expect(outcome).toEqual({ claimed: 1, dispatched: 1, failed: 0 })
    expect(notifications.calls).toHaveLength(0)
  })

  it('queues the newsletter confirm email with the signup, one job per signup row (D-09)', async () => {
    const storeId = await seedStore('relay-newsletter')
    const signupId = crypto.randomUUID()
    await withStore(app, storeId, async (tx) => {
      await insertOutboxEvent(tx, storeId, 'newsletter.confirm_requested', { signupId })
      await insertOutboxEvent(tx, storeId, 'newsletter.confirm_requested', { signupId })
    })
    const notifications = fakeQueue<{
      storeId: string
      orderId: string
      template: string
      signupId?: string
    }>()
    const outcome = await relayStoreOutbox(
      { db: app, plugins, notifications: notifications.queue },
      storeId,
    )
    expect(outcome).toEqual({ claimed: 2, dispatched: 2, failed: 0 })
    expect(notifications.calls.map((c) => c.data)).toEqual([
      expect.objectContaining({ template: 'newsletter_confirm', signupId, orderId: '' }),
      expect.objectContaining({ template: 'newsletter_confirm', signupId, orderId: '' }),
    ])
    expect(new Set(notifications.calls.map((c) => c.jobId)).size).toBe(2)
  })
})
