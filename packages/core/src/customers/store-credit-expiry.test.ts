/** SOURCE OF TRUTH: store credit expiry tests — WHAT: credits with an expiry date spent soonest-first, what is left taken off on the day with one `expiry` line, never spendable after it (write-time and read-time), the sweep idempotent, refunds never expiring / WHY: expiry moves the customer's money, so it must be exact, happen once and never let expired credit be spent */
import { createDb, customer, order, store, storeCreditEntry, withStore } from '@commerce/db'
import { resetDb } from '@commerce/db/test'
import { eq } from 'drizzle-orm'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import {
  changeStoreCredit,
  refundToStoreCredit,
  StoreCreditError,
  shopperStoreCredit,
  storeCreditOf,
} from './store-credit'
import { spendStoreCreditOnOrder } from './store-credit-checkout'
import {
  dueLots,
  openLots,
  spendableStoreCredit,
  storeCreditExpiryAt,
  storeCreditLastDay,
  sweepExpiredStoreCredit,
} from './store-credit-expiry'

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
const T0 = new Date('2026-11-12T06:00:00Z')
const at = (days: number) => new Date(T0.getTime() + days * DAY)

async function seed() {
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
      subtotalPaise: 50_000,
      totalPaise: 50_000,
      email: 'asha@example.com',
      customerId: cu?.id ?? null,
    })
    .returning()
  if (!cu || !o) throw new Error('seed')
  return { storeId: s.id, customerId: cu.id, orderId: o.id }
}

const inStore = <T>(storeId: string, fn: Parameters<typeof withStore<T>>[2]) =>
  withStore(app, storeId, fn)

/** Staff add credit at `now`, with an optional expiry. */
const add = (
  storeId: string,
  customerId: string,
  amountPaise: number,
  now: Date,
  expiresAt: Date | null = null,
) =>
  inStore(storeId, (tx) =>
    changeStoreCredit(
      { storeId, tx },
      { customerId, amountPaise, kind: 'adjustment', reason: 'Goodwill', expiresAt },
      now,
    ),
  )

const take = (storeId: string, customerId: string, amountPaise: number, now: Date) =>
  inStore(storeId, (tx) =>
    changeStoreCredit(
      { storeId, tx },
      { customerId, amountPaise: -amountPaise, kind: 'adjustment', reason: 'Spent' },
      now,
    ),
  )

describe('openLots (ledger replay)', () => {
  const line = (
    id: string,
    amountPaise: number,
    expiresAt: Date | null = null,
    kind = 'adjustment',
    expiredEntryId: string | null = null,
  ) => ({ id, amountPaise, kind, expiresAt, expiredEntryId })

  it('spends the credit that expires soonest first, credit that never expires last', () => {
    const lots = openLots([
      line('a', 1000, null),
      line('b', 500, at(30)),
      line('c', 300, at(10)),
      line('d', -600, null, 'payment'),
    ])
    // c (soonest) is used up, then 300 of b; the never-expiring 1000 is untouched.
    expect(lots).toEqual([{ entryId: 'b', expiresAt: at(30), remainingPaise: 200 }])
  })

  it('an expiry line empties only the credit it names', () => {
    const lots = openLots([
      line('a', 500, at(1)),
      line('b', 500, at(5)),
      line('x', -500, null, 'expiry', 'a'),
    ])
    expect(lots.map((l) => l.entryId)).toEqual(['b'])
    expect(dueLots(lots, at(6)).map((l) => l.remainingPaise)).toEqual([500])
  })
})

describe('store credit expiry', () => {
  it('the last day is spendable; the credit ends at the next midnight in store time', () => {
    const end = storeCreditExpiryAt('2026-12-31', 'Asia/Kolkata')
    expect(end.toISOString()).toBe('2026-12-31T18:30:00.000Z')
    expect(storeCreditLastDay(end, 'Asia/Kolkata')).toBe('2026-12-31')
  })

  it('refuses an expiry in the past or on a removal', async () => {
    const { storeId, customerId } = await seed()
    await expect(add(storeId, customerId, 1000, T0, at(-1))).rejects.toBeInstanceOf(
      StoreCreditError,
    )
    await add(storeId, customerId, 1000, T0)
    await expect(
      inStore(storeId, (tx) =>
        changeStoreCredit(
          { storeId, tx },
          {
            customerId,
            amountPaise: -100,
            kind: 'adjustment',
            reason: 'x',
            expiresAt: at(3),
          },
          T0,
        ),
      ),
    ).rejects.toBeInstanceOf(StoreCreditError)
  })

  it('takes only what is left of an expired credit, spending it first, with one expiry line', async () => {
    const { storeId, customerId } = await seed()
    await add(storeId, customerId, 100_000, T0) // never expires
    await add(storeId, customerId, 50_000, T0, at(10))
    await take(storeId, customerId, 30_000, at(1)) // from the expiring credit first
    // Readers already leave out the expired ₹200 before anything writes it.
    expect(
      await inStore(storeId, (tx) => spendableStoreCredit({ storeId, tx }, customerId, at(11))),
    ).toBe(100_000)
    const done = await inStore(storeId, (tx) => sweepExpiredStoreCredit({ storeId, tx }, at(11)))
    expect(done).toEqual({ customers: 1, expiredPaise: 20_000 })
    // Again: nothing left to expire.
    expect(
      await inStore(storeId, (tx) => sweepExpiredStoreCredit({ storeId, tx }, at(12))),
    ).toEqual({ customers: 0, expiredPaise: 0 })
    const rows = await owner
      .select()
      .from(storeCreditEntry)
      .where(eq(storeCreditEntry.kind, 'expiry'))
    expect(rows.map((r) => [r.amountPaise, r.balanceAfterPaise])).toEqual([[-20_000, 100_000]])
    const view = await inStore(storeId, (tx) => storeCreditOf({ storeId, tx }, customerId))
    expect(view.balancePaise).toBe(100_000)
    expect(view.entries[0]?.kind).toBe('expiry')
    expect(view.entries.find((e) => e.amountPaise === 50_000)?.expiresOn).toBe(
      storeCreditLastDay(at(10), 'Asia/Kolkata'),
    )
  })

  it('a change after the date writes the expiry first, so expired credit is never spent', async () => {
    const { storeId, customerId } = await seed()
    await add(storeId, customerId, 40_000, T0, at(2))
    await add(storeId, customerId, 10_000, T0)
    await expect(take(storeId, customerId, 20_000, at(3))).rejects.toMatchObject({
      reason: 'insufficient',
    })
    // The refused debit rolled back, expiry line and all; the next change writes it.
    const after = await take(storeId, customerId, 10_000, at(3))
    expect(after.balancePaise).toBe(0)
    const kinds = await owner
      .select({ kind: storeCreditEntry.kind, amount: storeCreditEntry.amountPaise })
      .from(storeCreditEntry)
      .orderBy(storeCreditEntry.id)
    expect(kinds.map((k) => [k.kind, k.amount])).toEqual([
      ['adjustment', 40_000],
      ['adjustment', 10_000],
      ['expiry', -40_000],
      ['adjustment', -10_000],
    ])
  })

  it('checkout spends only what has not expired', async () => {
    const { storeId, customerId, orderId } = await seed()
    // Added two days ago with an end a second ago: expired, but no expiry line written yet.
    await add(storeId, customerId, 30_000, new Date(Date.now() - 2 * DAY), new Date(Date.now() - 1000))
    await add(storeId, customerId, 5_000, new Date(Date.now() - 2 * DAY))
    const spent = await inStore(storeId, (tx) =>
      spendStoreCreditOnOrder({ storeId, tx }, { orderId, customerId, duePaise: 50_000 }),
    )
    expect(spent?.amountPaise).toBe(5_000)
    expect(spent?.balancePaise).toBe(0)
  })

  it('refunds never expire, and the shopper sees the last day of a credit', async () => {
    const { storeId, customerId, orderId } = await seed()
    await inStore(storeId, (tx) =>
      refundToStoreCredit({ storeId, tx }, { orderId, amountPaise: 12_000 }),
    )
    await add(storeId, customerId, 8_000, new Date(), new Date(Date.now() + 5 * DAY))
    const mine = await inStore(storeId, (tx) => shopperStoreCredit({ storeId, tx }, customerId))
    expect(mine.balancePaise).toBe(20_000)
    expect(mine.entries.map((e) => [e.kind, e.expiresOn !== null])).toEqual([
      ['adjustment', true],
      ['refund', false],
    ])
  })
})
