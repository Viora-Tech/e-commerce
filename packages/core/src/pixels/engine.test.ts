/** SOURCE OF TRUTH: Pixels engine tests (database) — WHAT: the relay queues Pixels jobs only for stores with the app, the order job picks pixels by trigger and logs skips, send jobs record success, retries, failures and a refused token (Error plus one owner alert), admin reads never carry the token, and the prune clears old rows and IPs / WHY: these are the once-only, consent and no-token rules the design promises; a fake fetch keeps Meta out */
import { createHash } from 'node:crypto'
import {
  address,
  createDb,
  order,
  orderLine,
  outboxEvent,
  pixelConnection,
  pixelEventDay,
  pixelEventLog,
  product,
  store,
  variant,
  withStore,
} from '@commerce/db'
import { resetDb } from '@commerce/db/test'
import { loadPlugins } from '@commerce/plugins'
import { eq } from 'drizzle-orm'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { relayStoreOutbox } from '../outbox/relay'
import { insertOutboxEvent } from '../outbox/write'
import { corePlugin } from '../plugins/core-plugin'
import { encryptSecret } from '../secrets'
import { createPixel, listPixels, pixelStats, sendPixelTest, setPixelToken } from './connections'
import type { PixelOrderJob, PixelSendJob } from './jobs'
import type { FetchLike } from './meta'
import { runPixelOrderJob } from './order-trigger'
import { prunePixelData } from './prune'
import { PixelRetryError, runPixelSendJob } from './send'

const owner = createDb(process.env.DATABASE_URL_OWNER as string)
const app = createDb(process.env.DATABASE_URL as string)
const SECRET = 'pixels-test-settings-secret-000000000000'
const FAKE_TOKEN = 'EAAfake-test-token-0000000000'
const plugins = loadPlugins([corePlugin])

beforeEach(async () => {
  await resetDb(owner)
})
afterAll(async () => {
  await owner.$client.end()
  await app.$client.end()
})

function fakeQueue<T>() {
  const calls: { data: T; jobId: string | undefined }[] = []
  return {
    calls,
    queue: {
      add: async (_name: string, data: T, opts?: { jobId?: string }) => {
        calls.push({ data, jobId: opts?.jobId })
      },
    },
  }
}

function fakeFetch(status: number, body: unknown) {
  const calls: { url: string; body: unknown }[] = []
  const fn: FetchLike = async (url, init) => {
    calls.push({ url, body: init.body ? JSON.parse(String(init.body)) : null })
    return new Response(JSON.stringify(body), { status })
  }
  return { fn, calls }
}

const consent = { marketing: true, analytics: true, version: 1, at: new Date().toISOString() }

async function seed(
  opts: { installed?: boolean; tracking?: object | null; isTest?: boolean } = {},
) {
  const [s] = await owner
    .insert(store)
    .values({
      slug: 'w',
      name: 'W',
      apps: { installed: opts.installed === false ? [] : ['pixels'] },
    })
    .returning()
  const storeId = s?.id as string
  const [p] = await owner.insert(product).values({ storeId, handle: 'p', title: 'P' }).returning()
  const [v] = await owner
    .insert(variant)
    .values({ storeId, productId: p?.id as string, title: 'V', pricePaise: 49_900 })
    .returning()
  const [a] = await owner
    .insert(address)
    .values({
      storeId,
      name: 'Asha Rao',
      line1: '1 MG Road',
      city: 'Pune',
      stateCode: 'MH',
      pincode: '411001',
      phone: '9876543210',
    })
    .returning()
  const [o] = await owner
    .insert(order)
    .values({
      storeId,
      number: 1042,
      status: 'open',
      subtotalPaise: 99_800,
      totalPaise: 99_800,
      email: 'asha@example.com',
      shippingAddressId: a?.id as string,
      paymentMethod: 'razorpay',
      isTest: opts.isTest ?? false,
      tracking:
        opts.tracking === null
          ? null
          : (opts.tracking ?? {
              fbp: 'fb.1.1792800000000.1234567890',
              ip: '203.0.113.7',
              ua: 'UA',
              consent,
            }),
    })
    .returning()
  await owner.insert(orderLine).values({
    storeId,
    orderId: o?.id as string,
    variantId: v?.id as string,
    quantity: 2,
    unitPricePaise: 49_900,
  })
  const [px] = await owner
    .insert(pixelConnection)
    .values({
      storeId,
      pixelId: '1234567890',
      name: 'Main',
      tokenEnc: encryptSecret(FAKE_TOKEN, SECRET),
      tokenHint: '0000',
    })
    .returning()
  return { storeId, orderId: o?.id as string, connectionId: px?.id as string }
}

async function orderRow(storeId: string, orderId: string, type: 'order.placed' | 'order.paid') {
  await withStore(app, storeId, (tx) => insertOutboxEvent(tx, storeId, type, { orderId }))
  const [row] = await owner.select().from(outboxEvent).where(eq(outboxEvent.type, type))
  return { storeId, outboxId: row?.id as string } satisfies PixelOrderJob
}

describe('relay', () => {
  it('queues a Pixels order job only when the store installed the app', async () => {
    const on = await seed()
    const pixelOrders = fakeQueue<PixelOrderJob>()
    const notifications = fakeQueue<unknown>()
    await withStore(app, on.storeId, (tx) =>
      insertOutboxEvent(tx, on.storeId, 'order.placed', { orderId: on.orderId }),
    )
    await relayStoreOutbox(
      { db: app, plugins, notifications: notifications.queue, pixelOrders: pixelOrders.queue },
      on.storeId,
    )
    expect(pixelOrders.calls).toHaveLength(1)
    expect(pixelOrders.calls[0]?.jobId).toMatch(/^px-order-/)

    await resetDb(owner)
    const off = await seed({ installed: false })
    const none = fakeQueue<PixelOrderJob>()
    await withStore(app, off.storeId, (tx) =>
      insertOutboxEvent(tx, off.storeId, 'order.placed', { orderId: off.orderId }),
    )
    await relayStoreOutbox(
      { db: app, plugins, notifications: notifications.queue, pixelOrders: none.queue },
      off.storeId,
    )
    expect(none.calls).toHaveLength(0)
  })
})

describe('order job', () => {
  it('queues Purchase for a "placed" pixel once, with an idempotent job id', async () => {
    const s = await seed()
    const job = await orderRow(s.storeId, s.orderId, 'order.placed')
    const send = fakeQueue<PixelSendJob>()
    expect(await runPixelOrderJob(app, job, send.queue)).toEqual({ queued: 1, skipped: 0 })
    expect(send.calls[0]?.jobId).toBe(`px-${s.connectionId}-Purchase-ord_${s.orderId}`)
    expect(send.calls[0]?.data).toEqual({
      storeId: s.storeId,
      connectionId: s.connectionId,
      origin: 'order',
      eventName: 'Purchase',
      eventId: `ord_${s.orderId}`,
      orderId: s.orderId,
    })
    // Job data holds ids only.
    expect(JSON.stringify(send.calls[0]?.data)).not.toMatch(/asha|9876543210|203\.0/)
  })

  it('ignores an order event that is not the pixel trigger', async () => {
    const s = await seed()
    const job = await orderRow(s.storeId, s.orderId, 'order.paid')
    const send = fakeQueue<PixelSendJob>()
    expect(await runPixelOrderJob(app, job, send.queue)).toEqual({ queued: 0, skipped: 0 })
  })

  it('logs skips: test order, no consent, too old, paused', async () => {
    const cases: [Parameters<typeof seed>[0], string, object?][] = [
      [{ isTest: true }, 'test_order'],
      [{ tracking: { fbp: 'x' } }, 'no_consent'],
      [{ tracking: null }, 'no_tracking'],
    ]
    for (const [opts, reason] of cases) {
      await resetDb(owner)
      const s = await seed(opts)
      const job = await orderRow(s.storeId, s.orderId, 'order.placed')
      const send = fakeQueue<PixelSendJob>()
      expect(await runPixelOrderJob(app, job, send.queue)).toEqual({ queued: 0, skipped: 1 })
      const [log] = await owner.select().from(pixelEventLog)
      expect(log?.skipReason).toBe(reason)
    }
    await resetDb(owner)
    const s = await seed()
    await owner.update(pixelConnection).set({ status: 'paused' })
    const job = await orderRow(s.storeId, s.orderId, 'order.placed')
    await runPixelOrderJob(app, job, fakeQueue<PixelSendJob>().queue)
    const [paused] = await owner.select().from(pixelEventLog)
    expect(paused?.skipReason).toBe('paused')
    await owner.delete(pixelEventLog)
    await owner.update(pixelConnection).set({ status: 'active' })
    const later = new Date(Date.now() + 8 * 24 * 3600 * 1000)
    await runPixelOrderJob(app, job, fakeQueue<PixelSendJob>().queue, later)
    const [old] = await owner.select().from(pixelEventLog)
    expect(old?.skipReason).toBe('too_old')
  })
})

describe('send job', () => {
  const purchase = (s: Awaited<ReturnType<typeof seed>>): PixelSendJob => ({
    storeId: s.storeId,
    connectionId: s.connectionId,
    origin: 'order',
    eventName: 'Purchase',
    eventId: `ord_${s.orderId}`,
    orderId: s.orderId,
  })

  it('sends hashed details and records sent; a second run sends nothing', async () => {
    const s = await seed()
    const meta = fakeFetch(200, { events_received: 1, fbtrace_id: 'TR' })
    const deps = { settingsSecret: SECRET, fetch: meta.fn }
    expect(await runPixelSendJob(app, purchase(s), deps)).toBe('sent')
    expect(await runPixelSendJob(app, purchase(s), deps)).toBe('sent')
    expect(meta.calls).toHaveLength(1)
    const body = JSON.stringify(meta.calls[0]?.body)
    expect(body).not.toContain('asha@example.com')
    expect(body).not.toContain('9876543210')
    const event = (
      meta.calls[0]?.body as { data: { custom_data: { value: number } }[] } | undefined
    )?.data[0]
    expect(event?.custom_data.value).toBe(998)
    const [log] = await owner.select().from(pixelEventLog)
    expect(log).toMatchObject({ status: 'sent', fbtraceId: 'TR', httpStatus: 200 })
    expect(log?.matched).toMatchObject({
      em: true,
      ph: true,
      fn: true,
      ct: true,
      fbp: true,
      ip: true,
    })
    expect(JSON.stringify(log)).not.toContain('asha')
    const [day] = await owner.select().from(pixelEventDay)
    expect(day?.sent).toBe(1)
  })

  it('the server Purchase carries the full hashed user_data plus the browser ids', async () => {
    const s = await seed({
      tracking: {
        fbp: 'fb.1.1792800000000.1234567890',
        fbc: 'fb.1.1792800000000.IwAR2abc',
        ip: '203.0.113.7',
        ua: 'UA',
        consent,
      },
    })
    const meta = fakeFetch(200, { events_received: 1, fbtrace_id: 'TR' })
    expect(
      await runPixelSendJob(app, purchase(s), { settingsSecret: SECRET, fetch: meta.fn }),
    ).toBe('sent')
    const sha = (v: string) => createHash('sha256').update(v, 'utf8').digest('hex')
    const sent = meta.calls[0]?.body as { data: { user_data: Record<string, unknown> }[] }
    const user = sent.data[0]?.user_data
    expect(user).toEqual({
      em: [sha('asha@example.com')],
      ph: [sha('919876543210')],
      fn: [sha('asha')],
      ln: [sha('rao')],
      ct: [sha('pune')],
      st: [sha('mh')],
      zp: [sha('411001')],
      country: [sha('in')],
      fbp: 'fb.1.1792800000000.1234567890',
      fbc: 'fb.1.1792800000000.IwAR2abc',
      client_ip_address: '203.0.113.7',
      client_user_agent: 'UA',
    })
  })

  it('throws to retry on throttling, and records failed on the last attempt', async () => {
    const s = await seed()
    const meta = fakeFetch(400, { error: { message: 'Too many calls', code: 17 } })
    const deps = { settingsSecret: SECRET, fetch: meta.fn }
    await expect(
      runPixelSendJob(app, purchase(s), deps, { attempt: 1, maxAttempts: 6 }),
    ).rejects.toBeInstanceOf(PixelRetryError)
    expect(await runPixelSendJob(app, purchase(s), deps, { attempt: 6, maxAttempts: 6 })).toBe(
      'failed',
    )
    const [log] = await owner.select().from(pixelEventLog)
    expect(log).toMatchObject({ status: 'failed', attempts: 6, error: 'Too many calls' })
  })

  it('a refused token turns the pixel to Error with one owner alert, and later jobs skip', async () => {
    const s = await seed()
    const meta = fakeFetch(400, {
      error: { message: `Error validating access token ${FAKE_TOKEN}`, code: 190 },
    })
    const deps = { settingsSecret: SECRET, fetch: meta.fn }
    expect(await runPixelSendJob(app, purchase(s), deps)).toBe('errored')
    const [px] = await owner.select().from(pixelConnection)
    expect(px?.status).toBe('errored')
    expect(px?.lastError).not.toContain(FAKE_TOKEN)
    const alerts = await owner
      .select()
      .from(outboxEvent)
      .where(eq(outboxEvent.type, 'pixel.connection_failed'))
    expect(alerts).toHaveLength(1)
    expect(JSON.stringify(alerts[0]?.payload)).not.toContain(FAKE_TOKEN)
    await owner.delete(pixelEventLog)
    expect(await runPixelSendJob(app, purchase(s), deps)).toBe('skipped')
    expect(meta.calls).toHaveLength(1)
  })
})

describe('admin service', () => {
  it('checks the token with Meta and never returns it', async () => {
    const s = await seed()
    await owner.delete(pixelConnection)
    const meta = fakeFetch(200, { id: '9876543210', name: 'Waimers pixel' })
    const r = await withStore(app, s.storeId, (tx) =>
      createPixel(
        tx,
        s.storeId,
        {
          platform: 'meta',
          pixelId: '9876543210',
          token: FAKE_TOKEN,
          name: '',
          events: ['PageView', 'Purchase'],
          purchaseTrigger: 'paid_or_delivered',
          testEventCode: 'TEST1',
        },
        { settingsSecret: SECRET, fetch: meta.fn },
      ),
    )
    expect(r.metaName).toBe('Waimers pixel')
    expect(r.pixel).toMatchObject({ name: 'Waimers pixel', hasToken: true, tokenHint: '0000' })
    const listed = await withStore(app, s.storeId, (tx) => listPixels(tx))
    expect(JSON.stringify([r, listed])).not.toContain(FAKE_TOKEN)
    expect(JSON.stringify(listed)).not.toContain('tokenEnc')
    const [stored] = await owner.select().from(pixelConnection)
    expect(stored?.tokenEnc).not.toContain(FAKE_TOKEN)

    const refused = fakeFetch(400, { error: { message: 'Invalid OAuth access token', code: 190 } })
    await expect(
      withStore(app, s.storeId, (tx) =>
        setPixelToken(
          tx,
          { id: stored?.id as string, token: `${FAKE_TOKEN}x` },
          { settingsSecret: SECRET, fetch: refused.fn },
        ),
      ),
    ).rejects.toThrow(/Meta refused/)
  })

  it('sends a test event with the test code and counts it', async () => {
    const s = await seed()
    await owner.update(pixelConnection).set({ testEventCode: 'TEST42' })
    const meta = fakeFetch(200, { events_received: 1, fbtrace_id: 'T' })
    const r = await withStore(app, s.storeId, (tx) =>
      sendPixelTest(tx, s.storeId, s.connectionId, { settingsSecret: SECRET, fetch: meta.fn }),
    )
    expect(r).toEqual({ ok: true, fbtraceId: 'T' })
    expect((meta.calls[0]?.body as { test_event_code: string } | undefined)?.test_event_code).toBe(
      'TEST42',
    )
    const stats = await withStore(app, s.storeId, (tx) => pixelStats(tx))
    expect(stats.sent).toBe(1)
  })
})

describe('prune', () => {
  it('deletes old log rows and clears old orders’ IP and user agent', async () => {
    const s = await seed()
    const old = new Date(Date.now() - 40 * 24 * 3600 * 1000)
    await owner.update(order).set({ placedAt: old })
    await owner.insert(pixelEventLog).values({
      storeId: s.storeId,
      connectionId: s.connectionId,
      eventId: 'e',
      eventName: 'PageView',
      origin: 'storefront',
      createdAt: old,
    })
    const r = await withStore(app, s.storeId, (tx) => prunePixelData(tx, s.storeId, new Date()))
    expect(r).toMatchObject({ logs: 1, orders: 1 })
    const [o] = await owner.select().from(order)
    expect(o?.tracking).toEqual({ fbp: 'fb.1.1792800000000.1234567890', consent })
  })
})
