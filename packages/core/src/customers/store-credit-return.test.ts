/** SOURCE OF TRUTH: returned store credit expiry tests — WHAT: spent credit coming back keeps its credit's dates when no one is asked (the unpaid-order expiry, a default refund), takes staff's date or "never" when they choose, the dialogs' pre-fill, and money refunded to store credit with or without an expiry / WHY: a cancel or refund must not quietly turn expiring credit into credit that never expires (owner, 12 Nov 2026) */
import {
  createDb,
  customer,
  order,
  payment,
  store,
  storeCreditEntry,
  withStore,
} from '@commerce/db'
import { resetDb } from '@commerce/db/test'
import { and, asc, eq, gt } from 'drizzle-orm'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { refundPayment } from '../order/refund'
import { cancelOrder } from '../order/status'
import { changeStoreCredit, storeCreditOf } from './store-credit'
import { spendStoreCreditOnOrder } from './store-credit-checkout'
import { spendableStoreCredit, storeCreditExpiryAt } from './store-credit-expiry'
import { splitReturn, storeCreditReturnDefault } from './store-credit-return'

const owner = createDb(process.env.DATABASE_URL_OWNER as string)
const app = createDb(process.env.DATABASE_URL as string)
const TZ = 'Asia/Kolkata'
const DAY = 24 * 60 * 60 * 1000

afterAll(async () => {
  await owner.$client.end()
  await app.$client.end()
})

beforeEach(async () => {
  await resetDb(owner)
})

const inStore = <T>(storeId: string, fn: Parameters<typeof withStore<T>>[2]) =>
  withStore(app, storeId, fn)

/** A day `n` days from now, as `YYYY-MM-DD` (IST). */
const dayIn = (n: number) =>
  new Date(Date.now() + n * DAY + 5.5 * 60 * 60 * 1000).toISOString().slice(0, 10)

async function seed(withCredit = true) {
  const [s] = await owner.insert(store).values({ slug: 'w', name: 'Waimers' }).returning()
  if (!s) throw new Error('seed')
  const [cu] = await owner
    .insert(customer)
    .values({ storeId: s.id, email: 'asha@example.com', name: 'Asha' })
    .returning()
  const [o] = await owner
    .insert(order)
    .values({
      storeId: s.id,
      number: 1001,
      status: 'open',
      subtotalPaise: 100_000,
      totalPaise: 100_000,
      email: 'asha@example.com',
      customerId: cu?.id ?? null,
    })
    .returning()
  if (!cu || !o) throw new Error('seed')
  const storeId = s.id
  const customerId = cu.id
  if (!withCredit) return { storeId, customerId, orderId: o.id }
  // ₹300 that runs out in 10 days, ₹500 that never does.
  await inStore(storeId, (tx) =>
    changeStoreCredit(
      { storeId, tx },
      {
        customerId,
        amountPaise: 30_000,
        kind: 'adjustment',
        reason: 'Goodwill',
        expiresAt: storeCreditExpiryAt(dayIn(10), TZ),
      },
    ),
  )
  await inStore(storeId, (tx) =>
    changeStoreCredit(
      { storeId, tx },
      { customerId, amountPaise: 50_000, kind: 'adjustment', reason: 'Goodwill' },
    ),
  )
  return { storeId, customerId, orderId: o.id }
}

/** Credit lines given back on the order, oldest first: [amount, last-day-or-null]. */
async function given(orderId: string) {
  const rows = await owner
    .select({ amount: storeCreditEntry.amountPaise, expiresAt: storeCreditEntry.expiresAt })
    .from(storeCreditEntry)
    .where(and(eq(storeCreditEntry.orderId, orderId), gt(storeCreditEntry.amountPaise, 0)))
    .orderBy(asc(storeCreditEntry.id))
  return rows.map((r) => [r.amount, r.expiresAt?.toISOString() ?? null])
}

describe('splitReturn', () => {
  const d1 = new Date('2026-12-01T00:00:00Z')
  const d2 = new Date('2026-12-20T00:00:00Z')
  const parts = [
    { amountPaise: 100, expiresAt: d1 },
    { amountPaise: 200, expiresAt: null },
    { amountPaise: 300, expiresAt: d2 },
    { amountPaise: 50, expiresAt: d1 },
  ]

  it('gives back never-expiring first, then the latest date, merging equal dates', () => {
    expect(splitReturn(parts, 650)).toEqual([
      { amountPaise: 200, expiresAt: null },
      { amountPaise: 300, expiresAt: d2 },
      { amountPaise: 150, expiresAt: d1 },
    ])
  })

  it('skips what went back before, and anything beyond the parts never expires', () => {
    expect(splitReturn(parts, 300, 400)).toEqual([
      { amountPaise: 100, expiresAt: d2 },
      { amountPaise: 150, expiresAt: d1 },
      { amountPaise: 50, expiresAt: null },
    ])
  })
})

describe('store credit coming back', () => {
  it('pre-fills the latest date, or empty when any of it never expires', async () => {
    const { storeId, customerId, orderId } = await seed()
    // ₹200 of the expiring credit only.
    await inStore(storeId, (tx) =>
      spendStoreCreditOnOrder({ storeId, tx }, { orderId, customerId, duePaise: 20_000 }),
    )
    expect(
      await inStore(storeId, (tx) => storeCreditReturnDefault({ storeId, tx }, orderId)),
    ).toEqual({ spentPaise: 20_000, expiresOn: dayIn(10) })
  })

  it('an unpaid order cancelled with no one to ask keeps each part’s original date', async () => {
    const { storeId, customerId, orderId } = await seed()
    // ₹800 held (all of it): ₹300 from the expiring credit (spent first), ₹500 never-expiring.
    await inStore(storeId, (tx) =>
      spendStoreCreditOnOrder({ storeId, tx }, { orderId, customerId, duePaise: 100_000 }),
    )
    expect(
      await inStore(storeId, (tx) => storeCreditReturnDefault({ storeId, tx }, orderId)),
    ).toEqual({ spentPaise: 80_000, expiresOn: null })
    await inStore(storeId, (tx) => cancelOrder({ storeId, tx }, orderId))
    expect(await given(orderId)).toEqual([
      [50_000, null],
      [30_000, storeCreditExpiryAt(dayIn(10), TZ).toISOString()],
    ])
    expect(
      (await inStore(storeId, (tx) => storeCreditOf({ storeId, tx }, customerId))).balancePaise,
    ).toBe(80_000)
  })

  it('staff choose on the cancel: a new date, or never', async () => {
    const { storeId, customerId, orderId } = await seed()
    await inStore(storeId, (tx) =>
      spendStoreCreditOnOrder({ storeId, tx }, { orderId, customerId, duePaise: 100_000 }),
    )
    await inStore(storeId, (tx) =>
      cancelOrder({ storeId, tx }, orderId, { storeCreditExpiresOn: dayIn(30) }),
    )
    expect(await given(orderId)).toEqual([
      [80_000, storeCreditExpiryAt(dayIn(30), TZ).toISOString()],
    ])
  })

  it('a staff cancel that clears the date gives it back never expiring', async () => {
    const { storeId, customerId, orderId } = await seed()
    await inStore(storeId, (tx) =>
      spendStoreCreditOnOrder({ storeId, tx }, { orderId, customerId, duePaise: 20_000 }),
    )
    await inStore(storeId, (tx) =>
      cancelOrder({ storeId, tx }, orderId, { storeCreditExpiresOn: null }),
    )
    expect(await given(orderId)).toEqual([[20_000, null]])
  })

  it('refunds of a store credit payment keep the dates by default, part by part', async () => {
    const { storeId, customerId, orderId } = await seed()
    // Covers it all: captured at once.
    await inStore(storeId, (tx) =>
      spendStoreCreditOnOrder({ storeId, tx }, { orderId, customerId, duePaise: 60_000 }),
    )
    const [p] = await owner.select().from(payment).where(eq(payment.orderId, orderId))
    expect(p?.status).toBe('captured')
    // Never-expiring part first (₹300), then the expiring one.
    await inStore(storeId, (tx) =>
      refundPayment({ storeId, tx }, null, { paymentId: p?.id as string, amountPaise: 40_000 }),
    )
    await inStore(storeId, (tx) =>
      refundPayment({ storeId, tx }, null, { paymentId: p?.id as string, amountPaise: 20_000 }),
    )
    const expiring = storeCreditExpiryAt(dayIn(10), TZ).toISOString()
    expect(await given(orderId)).toEqual([
      [30_000, null],
      [10_000, expiring],
      [20_000, expiring],
    ])
  })

  it('a refund of a store credit payment takes the date staff chose', async () => {
    const { storeId, customerId, orderId } = await seed()
    await inStore(storeId, (tx) =>
      spendStoreCreditOnOrder({ storeId, tx }, { orderId, customerId, duePaise: 60_000 }),
    )
    const [p] = await owner.select().from(payment).where(eq(payment.orderId, orderId))
    await inStore(storeId, (tx) =>
      refundPayment({ storeId, tx }, null, {
        paymentId: p?.id as string,
        amountPaise: 60_000,
        storeCreditExpiresOn: null,
      }),
    )
    expect(await given(orderId)).toEqual([[60_000, null]])
  })

  it('money refunded to store credit never expires unless staff pick a date', async () => {
    const { storeId, orderId } = await seed()
    const [p] = await owner
      .insert(payment)
      .values({
        storeId,
        orderId,
        provider: 'razorpay',
        providerRef: 'pay_1',
        providerPaymentId: 'pay_1',
        status: 'captured',
        amountPaise: 100_000,
      })
      .returning()
    await inStore(storeId, (tx) =>
      refundPayment({ storeId, tx }, null, {
        paymentId: p?.id as string,
        amountPaise: 10_000,
        method: 'store_credit',
      }),
    )
    await inStore(storeId, (tx) =>
      refundPayment({ storeId, tx }, null, {
        paymentId: p?.id as string,
        amountPaise: 15_000,
        method: 'store_credit',
        storeCreditExpiresOn: dayIn(7),
      }),
    )
    expect(await given(orderId)).toEqual([
      [10_000, null],
      [15_000, storeCreditExpiryAt(dayIn(7), TZ).toISOString()],
    ])
  })

  it('credit whose original date passed meanwhile comes back already expired', async () => {
    const { storeId, customerId, orderId } = await seed(false)
    const soon = new Date(Date.now() + 1500)
    // ₹100 that runs out in a moment, held on an order that is never paid.
    await inStore(storeId, (tx) =>
      changeStoreCredit(
        { storeId, tx },
        { customerId, amountPaise: 10_000, kind: 'adjustment', reason: 'x', expiresAt: soon },
      ),
    )
    await inStore(storeId, (tx) =>
      spendStoreCreditOnOrder({ storeId, tx }, { orderId, customerId, duePaise: 20_000 }),
    )
    await new Promise((r) => setTimeout(r, 2000))
    await inStore(storeId, (tx) => cancelOrder({ storeId, tx }, orderId))
    expect(await given(orderId)).toEqual([[10_000, soon.toISOString()]])
    expect(await inStore(storeId, (tx) => spendableStoreCredit({ storeId, tx }, customerId))).toBe(
      0,
    )
  })
})
