/** SOURCE OF TRUTH: Retention job tests (database) — WHAT: the nightly prune deletes carts past retention with their lines and keeps recent ones, unhooks recovery messages and marketing runs instead of failing on their foreign keys, works in batches inside one store, deletes old dispatched outbox rows and empties old settled webhook payloads while keeping the rows; every foreign key to `cart` is one the prune handles / WHY: these rules delete shopper data for good, so each boundary is pinned */
import {
  authSchema,
  cart,
  cartLine,
  createDb,
  marketingAutomation,
  marketingAutomationRun,
  notification,
  order,
  outboxEvent,
  paymentEvent,
  product,
  shipmentWebhookEvent,
  store,
  variant,
  withStore,
} from '@commerce/db'
import { resetDb } from '@commerce/db/test'
import { eq, sql } from 'drizzle-orm'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { pruneCartBatch } from './carts'
import { runRetentionJob } from './job'

const owner = createDb(process.env.DATABASE_URL_OWNER as string)
const app = createDb(process.env.DATABASE_URL as string)
const NOW = new Date()
const DAY_MS = 86_400_000
const daysAgo = (days: number) => new Date(NOW.getTime() - days * DAY_MS)

beforeEach(async () => {
  await resetDb(owner)
})
afterAll(async () => {
  await owner.$client.end()
  await app.$client.end()
})

/** A store with an organization (the job finds stores through them) and one variant. */
async function seedStore(slug: string) {
  await owner.insert(authSchema.organization).values({ id: `org-${slug}`, name: slug, slug })
  const [s] = await owner
    .insert(store)
    .values({ slug, name: slug, organizationId: `org-${slug}` })
    .returning()
  const storeId = s?.id as string
  const [p] = await owner
    .insert(product)
    .values({ storeId, handle: 'pad', title: 'Pad' })
    .returning()
  const [v] = await owner
    .insert(variant)
    .values({ storeId, productId: p?.id as string, title: 'Black', pricePaise: 1000 })
    .returning()
  return { storeId, variantId: v?.id as string }
}

type Seeded = Awaited<ReturnType<typeof seedStore>>

/** A cart last touched `days` ago, with `lines` lines. */
async function addCart(
  s: Seeded,
  days: number,
  opts: {
    status?: 'open' | 'converted' | 'abandoned'
    email?: string
    phone?: string
    lines?: number
  } = {},
) {
  const at = daysAgo(days)
  const [c] = await owner
    .insert(cart)
    .values({
      storeId: s.storeId,
      status: opts.status ?? 'open',
      email: opts.email ?? null,
      phone: opts.phone ?? null,
      createdAt: at,
      updatedAt: at,
    })
    .returning()
  const cartId = c?.id as string
  for (let i = 0; i < (opts.lines ?? 1); i += 1) {
    await owner.insert(cartLine).values({
      storeId: s.storeId,
      cartId,
      variantId: s.variantId,
      quantity: 1,
      unitPricePaise: 1000,
    })
  }
  return cartId
}

async function cartIds(storeId: string) {
  const rows = await owner.select({ id: cart.id }).from(cart).where(eq(cart.storeId, storeId))
  return rows.map((r) => r.id).sort()
}

async function lineCount() {
  const [r] = await owner.select({ n: sql<number>`count(*)::int` }).from(cartLine)
  return r?.n ?? 0
}

describe('cart prune', () => {
  it('deletes carts past retention with their lines and keeps the rest', async () => {
    const s = await seedStore('w')
    const gone = [
      await addCart(s, 31, { lines: 2 }),
      await addCart(s, 31, { status: 'abandoned' }),
      await addCart(s, 91, { email: 'old@example.in' }),
      await addCart(s, 91, { status: 'abandoned', phone: '9876543210' }),
      await addCart(s, 31, { status: 'converted', email: 'won@example.in' }),
    ]
    const kept = [
      await addCart(s, 29),
      await addCart(s, 31, { email: 'recent@example.in', lines: 3 }),
      await addCart(s, 89, { phone: '9876543210' }),
      await addCart(s, 29, { status: 'converted', email: 'won@example.in' }),
    ]
    expect(await cartIds(s.storeId)).toHaveLength(9)
    expect(await lineCount()).toBe(12)

    const r = await runRetentionJob(app, NOW)

    expect(r).toMatchObject({ stores: 1, carts: gone.length })
    expect(await cartIds(s.storeId)).toEqual([...kept].sort())
    expect(await lineCount()).toBe(6)
  })

  it('keeps recovery messages and marketing runs, unhooked, and orders keep their cart id', async () => {
    const s = await seedStore('w')
    const recoverable = await addCart(s, 91, { email: 'old@example.in' })
    const converted = await addCart(s, 31, { status: 'converted', email: 'won@example.in' })
    await owner.insert(notification).values({
      storeId: s.storeId,
      cartId: recoverable,
      channel: 'email',
      template: 'abandoned_checkout',
      to: 'old@example.in',
      status: 'sent',
    })
    const [automation] = await owner
      .insert(marketingAutomation)
      .values({
        storeId: s.storeId,
        template: 'abandoned_checkout',
        trigger: 'abandoned_checkout',
        name: 'Recover',
      })
      .returning()
    await owner.insert(marketingAutomationRun).values({
      storeId: s.storeId,
      automationId: automation?.id as string,
      triggerKey: `cart:${recoverable}`,
      cartId: recoverable,
      email: 'old@example.in',
      status: 'completed',
    })
    await owner.insert(order).values({
      storeId: s.storeId,
      number: 1001,
      subtotalPaise: 1000,
      totalPaise: 1000,
      cartId: converted,
    })

    const r = await runRetentionJob(app, NOW)

    expect(r.carts).toBe(2)
    expect(await cartIds(s.storeId)).toEqual([])
    const [message] = await owner.select().from(notification)
    expect(message).toMatchObject({ cartId: null, to: 'old@example.in', status: 'sent' })
    const [run] = await owner.select().from(marketingAutomationRun)
    expect(run).toMatchObject({ cartId: null, email: 'old@example.in', status: 'completed' })
    const [o] = await owner.select().from(order)
    expect(o?.cartId).toBe(converted)
  })

  it('works in batches inside one store', async () => {
    const a = await seedStore('a')
    const b = await seedStore('b')
    for (let i = 0; i < 5; i += 1) await addCart(a, 40)
    const other = await addCart(b, 40)

    const batches: number[] = []
    for (;;) {
      const n = await withStore(app, a.storeId, (tx) => pruneCartBatch(tx, NOW, 2))
      batches.push(n)
      if (n < 2) break
    }

    expect(batches).toEqual([2, 2, 1])
    expect(await cartIds(a.storeId)).toEqual([])
    expect(await cartIds(b.storeId)).toEqual([other])
    // The job drains every store the same way, a batch at a time.
    expect(await runRetentionJob(app, NOW, { batch: 2 })).toMatchObject({ stores: 2, carts: 1 })
  })

  it('every foreign key to cart is one the prune deletes or clears', async () => {
    const rows = await owner.execute<{ table: string; column: string }>(sql`
      select c.conrelid::regclass::text as "table", a.attname as "column"
      from pg_constraint c
      join pg_attribute a on a.attrelid = c.conrelid and a.attnum = any (c.conkey)
      where c.contype = 'f' and c.confrelid = 'public.cart'::regclass
      order by 1, 2`)
    // A new table pointing at cart: delete or clear its rows in pruneCartBatch, then add it here.
    expect(rows.map((r) => `${r.table}.${r.column}`)).toEqual([
      'cart_line.cart_id',
      'marketing_automation_run.cart_id',
      'notification.cart_id',
    ])
  })
})

describe('log retention', () => {
  it('deletes outbox rows dispatched over 30 days ago and nothing undispatched', async () => {
    const s = await seedStore('w')
    const row = (createdDays: number, dispatchedDays: number | null) => ({
      storeId: s.storeId,
      type: 'order.placed',
      payload: { orderId: 'o' },
      createdAt: daysAgo(createdDays),
      dispatchedAt: dispatchedDays === null ? null : daysAgo(dispatchedDays),
    })
    const inserted = await owner
      .insert(outboxEvent)
      .values([row(31, 31), row(45, 44), row(29, 29), row(60, null)])
      .returning({ id: outboxEvent.id })

    const r = await runRetentionJob(app, NOW)

    expect(r.outboxEvents).toBe(2)
    const left = await owner.select({ id: outboxEvent.id }).from(outboxEvent)
    expect(left.map((x) => x.id).sort()).toEqual([inserted[2]?.id, inserted[3]?.id].sort())
  })

  it('empties settled webhook payloads after 180 days and keeps the rows', async () => {
    const s = await seedStore('w')
    const pii = { email: 'asha@example.com', contact: '+919876543210', card: { last4: '4242' } }
    const payment = (
      eventId: string,
      days: number,
      status: 'pending' | 'processed' | 'failed',
    ) => ({
      storeId: s.storeId,
      provider: 'razorpay',
      eventId,
      type: 'payment.captured',
      payload: pii,
      status,
      error: status === 'failed' ? 'amount mismatch' : null,
      receivedAt: daysAgo(days),
      processedAt: status === 'pending' ? null : daysAgo(days),
    })
    await owner
      .insert(paymentEvent)
      .values([
        payment('old-processed', 181, 'processed'),
        payment('old-failed', 181, 'failed'),
        payment('old-pending', 181, 'pending'),
        payment('recent', 179, 'processed'),
      ])
    const parcel = (eventId: string, days: number, status: 'pending' | 'processed') => ({
      storeId: s.storeId,
      provider: 'delhivery',
      eventId,
      waybill: `WB-${eventId}`,
      payload: { consignee: 'Asha Rao', phone: '9876543210', address: '1 MG Road' },
      status,
      receivedAt: daysAgo(days),
    })
    await owner
      .insert(shipmentWebhookEvent)
      .values([parcel('old-processed', 200, 'processed'), parcel('old-pending', 200, 'pending')])
    const before = await owner.select().from(paymentEvent)

    const r = await runRetentionJob(app, NOW)

    expect(r).toMatchObject({ paymentPayloads: 2, shipmentPayloads: 1 })
    const after = await owner.select().from(paymentEvent)
    for (const row of after) {
      const was = before.find((b) => b.id === row.id)
      const emptied = row.eventId === 'old-processed' || row.eventId === 'old-failed'
      expect(row).toEqual({ ...was, payload: emptied ? {} : pii })
    }
    const parcels = await owner.select().from(shipmentWebhookEvent)
    expect(
      parcels.map((p) => [p.eventId, p.waybill, p.status, Object.keys(p.payload as object).length]),
    ).toEqual(
      expect.arrayContaining([
        ['old-processed', 'WB-old-processed', 'processed', 0],
        ['old-pending', 'WB-old-pending', 'pending', 3],
      ]),
    )
    // Emptied rows are not rewritten every night.
    expect(await runRetentionJob(app, NOW)).toMatchObject({
      paymentPayloads: 0,
      shipmentPayloads: 0,
    })
  })

  it('logs a part that fails and goes on with the rest', async () => {
    const a = await seedStore('a')
    const b = await seedStore('b')
    const stuck = await addCart(a, 40)
    // Another store's message pointing at this cart: hidden from store A by RLS, so its
    // foreign key keeps the cart from being deleted.
    await owner.insert(notification).values({
      storeId: b.storeId,
      cartId: stuck,
      channel: 'email',
      template: 'abandoned_checkout',
      to: 'x@example.in',
    })
    await owner.insert(outboxEvent).values({
      storeId: a.storeId,
      type: 'order.placed',
      payload: {},
      dispatchedAt: daysAgo(31),
    })
    const logged: string[] = []

    const r = await runRetentionJob(app, NOW, { log: (m) => logged.push(m) })

    expect(logged).toEqual([expect.stringContaining(`[retention] carts for ${a.storeId} failed`)])
    expect(r).toMatchObject({ stores: 2, carts: 0, outboxEvents: 1 })
    expect(await cartIds(a.storeId)).toEqual([stuck])
  })
})
