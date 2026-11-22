/** SOURCE OF TRUTH: loyalty points tests — WHAT: an order earns after the return window (once), refunds and cancels take points back, points expire oldest first, review and birthday points come once, points pay at checkout as store credit, and staff adjust with a reason / WHY: points are store credit, so every rule moves real money and must happen exactly once */
import {
  createDb,
  customer,
  loyaltyEntry,
  order,
  orderLine,
  payment,
  product,
  refund,
  store,
  variant,
  withStore,
} from '@commerce/db'
import { resetDb } from '@commerce/db/test'
import { eq, sql } from 'drizzle-orm'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { StoreCreditError } from '../customers/store-credit'
import { spendStoreCreditOnOrder } from '../customers/store-credit-checkout'
import { spendableStoreCredit } from '../customers/store-credit-expiry'
import { creditDueEntry, duePointEntryIds, planOrderPoints, reverseOrderPoints } from './earn'
import { grantBirthdayPoints, grantReviewPoints, setCustomerBirthday } from './extras'
import { adjustPoints, pointsSummary } from './ledger'
import { defaultLoyaltySettings, type LoyaltySettings } from './settings'

const owner = createDb(process.env.DATABASE_URL_OWNER as string)
const app = createDb(process.env.DATABASE_URL as string)

afterAll(async () => {
  await owner.$client.end()
  await app.$client.end()
})

beforeEach(async () => {
  await resetDb(owner)
})

const DAY = 24 * 60 * 60 * 1000
const T0 = new Date('2026-11-23T06:00:00Z')
const at = (days: number) => new Date(T0.getTime() + days * DAY)
const S: LoyaltySettings = defaultLoyaltySettings

const inStore = <T>(storeId: string, fn: Parameters<typeof withStore<T>>[2]) =>
  withStore(app, storeId, fn)

async function seed() {
  const [s] = await owner.insert(store).values({ slug: 'w', name: 'Waimers' }).returning()
  if (!s) throw new Error('seed')
  const [p] = await owner
    .insert(product)
    .values({ storeId: s.id, handle: 'pad', title: 'Maboroshi pad', status: 'active' })
    .returning()
  if (!p) throw new Error('seed')
  const [v] = await owner
    .insert(variant)
    .values({ storeId: s.id, productId: p.id, title: 'XL', pricePaise: 250_000 })
    .returning()
  const [cu] = await owner
    .insert(customer)
    .values({ storeId: s.id, email: 'asha@example.com', name: 'Asha' })
    .returning()
  if (!v || !cu) throw new Error('seed')
  return { storeId: s.id, productId: p.id, variantId: v.id, customerId: cu.id }
}

let nextNumber = 1001

/** A delivered cash on delivery order of `goodsPaise` (one line), with its COD payment row. */
async function deliveredOrder(
  t: Awaited<ReturnType<typeof seed>>,
  goodsPaise: number,
  extra: Partial<typeof order.$inferInsert> = {},
) {
  const [o] = await owner
    .insert(order)
    .values({
      storeId: t.storeId,
      number: nextNumber++,
      status: 'open',
      subtotalPaise: goodsPaise,
      shippingPaise: 4_900,
      totalPaise: goodsPaise + 4_900,
      customerId: t.customerId,
      email: 'asha@example.com',
      paymentMethod: 'cod',
      paymentStatus: 'paid',
      fulfillmentStatus: 'delivered',
      ...extra,
    })
    .returning()
  if (!o) throw new Error('seed')
  await owner.insert(orderLine).values({
    storeId: t.storeId,
    orderId: o.id,
    variantId: t.variantId,
    title: 'Maboroshi pad',
    quantity: 1,
    unitPricePaise: goodsPaise,
  })
  const [pay] = await owner
    .insert(payment)
    .values({
      storeId: t.storeId,
      orderId: o.id,
      provider: 'cod',
      providerRef: `cod_${o.number}`,
      status: 'captured',
      amountPaise: goodsPaise + 4_900,
    })
    .returning()
  if (!pay) throw new Error('seed')
  return { orderId: o.id, paymentId: pay.id }
}

/** Plans on delivery at `T0`, then runs the sweep's credit step at `now`. */
async function earn(storeId: string, orderId: string, now: Date) {
  await inStore(storeId, (tx) => planOrderPoints({ storeId, tx }, orderId, S, T0))
  const ids = await inStore(storeId, (tx) => duePointEntryIds({ storeId, tx }, now))
  for (const id of ids) await inStore(storeId, (tx) => creditDueEntry({ storeId, tx }, id, S, now))
}

const summary = (storeId: string, customerId: string, now: Date, soonDays = 30) =>
  inStore(storeId, (tx) => pointsSummary({ storeId, tx }, customerId, soonDays, now))

describe('earning on orders', () => {
  it('earns 1 point per ₹100 of goods, credited only after the return window, once', async () => {
    const t = await seed()
    const { orderId } = await deliveredOrder(t, 250_000) // ₹2,500 → 25 points; shipping earns none
    await earn(t.storeId, orderId, at(3))
    expect((await summary(t.storeId, t.customerId, at(3))).points).toBe(0)
    expect((await summary(t.storeId, t.customerId, at(3))).pendingPoints).toBe(25)
    await earn(t.storeId, orderId, at(8))
    await earn(t.storeId, orderId, at(9))
    expect((await summary(t.storeId, t.customerId, at(9))).points).toBe(25)
    expect(
      await inStore(t.storeId, (tx) =>
        spendableStoreCredit({ storeId: t.storeId, tx }, t.customerId, at(9)),
      ),
    ).toBe(2_500)
    const rows = await owner.select().from(loyaltyEntry).where(eq(loyaltyEntry.orderId, orderId))
    expect(rows).toHaveLength(1)
    expect(rows[0]?.status).toBe('credited')
  })

  it('earns nothing on store credit spent, a test order or an order with no customer', async () => {
    const t = await seed()
    const test = await deliveredOrder(t, 100_000, { isTest: true })
    const guest = await deliveredOrder(t, 100_000, { customerId: null })
    for (const o of [test, guest]) {
      const row = await inStore(t.storeId, (tx) =>
        planOrderPoints({ storeId: t.storeId, tx }, o.orderId, S, T0),
      )
      expect(row).toBeNull()
    }
    const paidWithCredit = await deliveredOrder(t, 100_000)
    await owner.insert(payment).values({
      storeId: t.storeId,
      orderId: paidWithCredit.orderId,
      provider: 'store_credit',
      providerRef: 'sc_1',
      status: 'captured',
      amountPaise: 60_000,
    })
    const row = await inStore(t.storeId, (tx) =>
      planOrderPoints({ storeId: t.storeId, tx }, paidWithCredit.orderId, S, T0),
    )
    expect(row?.points).toBe(4) // ₹1,000 − ₹600 of store credit = ₹400
  })
})

describe('taking points back', () => {
  it('a refund in the return window lowers the points; a cancel before credit cancels them', async () => {
    const t = await seed()
    const a = await deliveredOrder(t, 300_000)
    await inStore(t.storeId, (tx) => planOrderPoints({ storeId: t.storeId, tx }, a.orderId, S, T0))
    await owner.insert(refund).values({
      storeId: t.storeId,
      orderId: a.orderId,
      paymentId: a.paymentId,
      amountPaise: 100_000,
      status: 'manual',
    })
    await inStore(t.storeId, (tx) =>
      reverseOrderPoints({ storeId: t.storeId, tx }, a.orderId, S, at(1)),
    )
    const b = await deliveredOrder(t, 200_000)
    await inStore(t.storeId, (tx) => planOrderPoints({ storeId: t.storeId, tx }, b.orderId, S, T0))
    await owner.update(order).set({ status: 'cancelled' }).where(eq(order.id, b.orderId))
    await inStore(t.storeId, (tx) =>
      reverseOrderPoints({ storeId: t.storeId, tx }, b.orderId, S, at(1)),
    )
    await earn(t.storeId, a.orderId, at(8))
    expect((await summary(t.storeId, t.customerId, at(8))).points).toBe(20)
    const [cancelled] = await owner
      .select()
      .from(loyaltyEntry)
      .where(eq(loyaltyEntry.orderId, b.orderId))
    expect(cancelled?.status).toBe('cancelled')
  })

  it('a refund after credit takes the difference back once, even when the event repeats', async () => {
    const t = await seed()
    const a = await deliveredOrder(t, 500_000)
    await earn(t.storeId, a.orderId, at(8)) // 50 points
    await owner.insert(refund).values({
      storeId: t.storeId,
      orderId: a.orderId,
      paymentId: a.paymentId,
      amountPaise: 200_000,
      status: 'processed',
    })
    const reverse = () =>
      inStore(t.storeId, (tx) =>
        reverseOrderPoints({ storeId: t.storeId, tx }, a.orderId, S, at(9)),
      )
    expect(await reverse()).toBe(20)
    expect(await reverse()).toBe(0)
    expect((await summary(t.storeId, t.customerId, at(9))).points).toBe(30)
  })

  it('an RTO takes every point back', async () => {
    const t = await seed()
    const a = await deliveredOrder(t, 100_000)
    await earn(t.storeId, a.orderId, at(8))
    const taken = await inStore(t.storeId, (tx) =>
      reverseOrderPoints({ storeId: t.storeId, tx }, a.orderId, S, at(9), { voided: true }),
    )
    expect(taken).toBe(10)
    expect((await summary(t.storeId, t.customerId, at(9))).points).toBe(0)
  })
})

describe('expiry', () => {
  it('spends the oldest points first and lets the rest run out 12 months after earning', async () => {
    const t = await seed()
    const first = await deliveredOrder(t, 100_000) // 10 points, credited at(8)
    await earn(t.storeId, first.orderId, at(8))
    const second = await deliveredOrder(t, 200_000) // 20 points, credited at(40)
    await inStore(t.storeId, (tx) =>
      planOrderPoints({ storeId: t.storeId, tx }, second.orderId, S, at(32)),
    )
    for (const id of await inStore(t.storeId, (tx) =>
      duePointEntryIds({ storeId: t.storeId, tx }, at(40)),
    )) {
      await inStore(t.storeId, (tx) => creditDueEntry({ storeId: t.storeId, tx }, id, S, at(40)))
    }
    // Spend 15 points at checkout: 10 from the first batch, 5 from the second.
    const spend = await deliveredOrder(t, 100_000, { fulfillmentStatus: 'unfulfilled' })
    await inStore(t.storeId, (tx) =>
      spendStoreCreditOnOrder(
        { storeId: t.storeId, tx },
        { orderId: spend.orderId, customerId: t.customerId, duePaise: 1_500 },
      ),
    )
    expect((await summary(t.storeId, t.customerId, at(41))).points).toBe(15)
    // A year after the first batch: nothing of it is left, so nothing runs out.
    expect((await summary(t.storeId, t.customerId, at(374))).points).toBe(15)
    // A year after the second batch: its last 15 points are gone.
    expect((await summary(t.storeId, t.customerId, at(406))).points).toBe(0)
  })

  it('says which points run out soon', async () => {
    const t = await seed()
    const a = await deliveredOrder(t, 100_000)
    await earn(t.storeId, a.orderId, at(8))
    expect((await summary(t.storeId, t.customerId, at(100))).expiringSoon).toBeNull()
    const soon = (await summary(t.storeId, t.customerId, at(360), 14)).expiringSoon
    expect(soon?.points).toBe(10)
  })
})

describe('review and birthday points', () => {
  it('a review of a delivered product earns once per product', async () => {
    const t = await seed()
    await deliveredOrder(t, 100_000)
    const review = (n: number) =>
      owner.execute(sql`insert into review (id, store_id, product_id, customer_id, rating, status, source, published_at, created_at, updated_at)
        values (gen_random_uuid(), ${t.storeId}, ${t.productId}, ${t.customerId}, ${n}, 'published', 'storefront', ${at(1).toISOString()}::timestamptz, now(), now())`)
    await review(5)
    await review(4)
    const grant = () =>
      inStore(t.storeId, (tx) => grantReviewPoints({ storeId: t.storeId, tx }, S, at(2)))
    expect(await grant()).toBe(1)
    expect(await grant()).toBe(0)
    const rows = await owner.select().from(loyaltyEntry).where(eq(loyaltyEntry.source, 'review'))
    expect(rows.map((r) => r.points)).toEqual([25])
  })

  it('no review points without a delivered order of the product', async () => {
    const t = await seed()
    await deliveredOrder(t, 100_000, { fulfillmentStatus: 'shipped' })
    await owner.execute(sql`insert into review (id, store_id, product_id, customer_id, rating, status, source, published_at, created_at, updated_at)
      values (gen_random_uuid(), ${t.storeId}, ${t.productId}, ${t.customerId}, 5, 'published', 'storefront', ${at(1).toISOString()}::timestamptz, now(), now())`)
    expect(
      await inStore(t.storeId, (tx) => grantReviewPoints({ storeId: t.storeId, tx }, S, at(2))),
    ).toBe(0)
  })

  it('birthday points come on the day, once a year; the shopper sets the birthday once', async () => {
    const t = await seed()
    const set = (v: string, by: 'shopper' | 'staff') =>
      inStore(t.storeId, (tx) =>
        setCustomerBirthday({ storeId: t.storeId, tx }, t.customerId, v, by),
      )
    expect(await set('1995-11-23', 'shopper')).toEqual({ ok: true, birthday: '11-23' })
    expect(await set('1995-12-01', 'shopper')).toEqual({ ok: false, reason: 'already_set' })
    const grant = (now: Date) =>
      inStore(t.storeId, (tx) => grantBirthdayPoints({ storeId: t.storeId, tx }, S, now))
    expect(await grant(T0)).toBe(1)
    expect(await grant(at(0))).toBe(0)
    expect(await grant(at(1))).toBe(0)
    expect(await grant(at(365))).toBe(1) // 23 Nov 2027
  })
})

describe('redeeming and staff adjustments', () => {
  it('points pay at checkout like store credit', async () => {
    const t = await seed()
    const a = await deliveredOrder(t, 400_000)
    await earn(t.storeId, a.orderId, at(8)) // 40 points = ₹40
    const next = await deliveredOrder(t, 100_000, { fulfillmentStatus: 'unfulfilled' })
    const spent = await inStore(t.storeId, (tx) =>
      spendStoreCreditOnOrder(
        { storeId: t.storeId, tx },
        { orderId: next.orderId, customerId: t.customerId, duePaise: 100_000 },
      ),
    )
    expect(spent?.amountPaise).toBe(4_000)
    expect((await summary(t.storeId, t.customerId, new Date())).points).toBe(0)
  })

  it('staff add and remove points with a reason; a removal cannot exceed the points', async () => {
    const t = await seed()
    const adjust = (points: number) =>
      inStore(t.storeId, (tx) =>
        adjustPoints(
          { storeId: t.storeId, tx },
          { customerId: t.customerId, points, reason: 'Thanks', staffEmail: 'staff@example.com' },
          S,
          T0,
        ),
      )
    expect((await adjust(50)).points).toBe(50)
    expect((await adjust(-20)).points).toBe(30)
    await expect(adjust(-31)).rejects.toBeInstanceOf(StoreCreditError)
    const rows = await owner
      .select()
      .from(loyaltyEntry)
      .where(eq(loyaltyEntry.source, 'adjustment'))
    expect(rows.map((r) => [r.points, r.staffEmail])).toEqual(
      expect.arrayContaining([
        [50, 'staff@example.com'],
        [-20, 'staff@example.com'],
      ]),
    )
  })
})
