/** SOURCE OF TRUTH: store credit tests — WHAT: add/remove with a reason, never below zero, paying an order from the balance, and a refund to store credit landing on a customer's balance (found or made from a guest order's email or phone, refused with neither), never a gift card / WHY: store credit is the customer's money, so every change must be exact and leave a ledger line */
import {
  createDb,
  customer,
  giftCard,
  order,
  payment,
  refund,
  store,
  storeCreditEntry,
  withStore,
} from '@commerce/db'
import { resetDb } from '@commerce/db/test'
import { eq } from 'drizzle-orm'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { refundPayment } from '../order/refund'
import {
  changeStoreCredit,
  payOrderWithStoreCredit,
  StoreCreditError,
  storeCreditOf,
} from './store-credit'

const owner = createDb(process.env.DATABASE_URL_OWNER as string)
const app = createDb(process.env.DATABASE_URL as string)
const SECRET = 'test-secret-test-secret-test-secret'

afterAll(async () => {
  await owner.$client.end()
  await app.$client.end()
})

beforeEach(async () => {
  await resetDb(owner)
})

async function seed(withCustomer = true) {
  const [s] = await owner.insert(store).values({ slug: 'w', name: 'Waimers' }).returning()
  if (!s) throw new Error('seed')
  const [cu] = await owner
    .insert(customer)
    .values({ storeId: s.id, email: 'shriram@example.com', name: 'Shriram V' })
    .returning()
  const [o] = await owner
    .insert(order)
    .values({
      storeId: s.id,
      number: 2424,
      status: 'open',
      subtotalPaise: 99_800,
      totalPaise: 99_800,
      email: 'shriram@example.com',
      customerId: withCustomer ? (cu?.id ?? null) : null,
    })
    .returning()
  if (!o || !cu) throw new Error('seed')
  return { storeId: s.id, customerId: cu.id, orderId: o.id }
}

const inStore = <T>(storeId: string, fn: Parameters<typeof withStore<T>>[2]) =>
  withStore(app, storeId, fn)

describe('store credit', () => {
  it('adds and removes credit with a reason, newest change first', async () => {
    const { storeId, customerId } = await seed()
    const staff = { userId: 'u1', email: 'owner@waimers.in' }
    await inStore(storeId, (tx) =>
      changeStoreCredit(
        { storeId, tx },
        {
          customerId,
          amountPaise: 190_000,
          kind: 'adjustment',
          reason: 'Moved from gift card G49E',
          staff,
        },
      ),
    )
    const after = await inStore(storeId, (tx) =>
      changeStoreCredit(
        { storeId, tx },
        { customerId, amountPaise: -10_000, kind: 'adjustment', reason: 'Typo', staff },
      ),
    )
    expect(after.balancePaise).toBe(180_000)
    const account = await inStore(storeId, (tx) => storeCreditOf({ storeId, tx }, customerId))
    expect(account.balancePaise).toBe(180_000)
    expect(account.entries.map((e) => [e.amountPaise, e.balanceAfterPaise, e.reason])).toEqual([
      [-10_000, 180_000, 'Typo'],
      [190_000, 190_000, 'Moved from gift card G49E'],
    ])
    expect(account.entries[0]?.staffEmail).toBe('owner@waimers.in')
  })

  it('never goes below zero and needs a reason', async () => {
    const { storeId, customerId } = await seed()
    await expect(
      inStore(storeId, (tx) =>
        changeStoreCredit(
          { storeId, tx },
          { customerId, amountPaise: -1, kind: 'adjustment', reason: 'Remove' },
        ),
      ),
    ).rejects.toMatchObject({ reason: 'insufficient' })
    await expect(
      inStore(storeId, (tx) =>
        changeStoreCredit(
          { storeId, tx },
          { customerId, amountPaise: 100, kind: 'adjustment', reason: ' ' },
        ),
      ),
    ).rejects.toBeInstanceOf(StoreCreditError)
    expect(await owner.select().from(storeCreditEntry)).toEqual([])
  })

  it("pays an order from the customer's balance, and refuses when it is too low", async () => {
    const { storeId, customerId, orderId } = await seed()
    await inStore(storeId, (tx) =>
      changeStoreCredit(
        { storeId, tx },
        { customerId, amountPaise: 190_000, kind: 'adjustment', reason: 'Credit' },
      ),
    )
    const paid = await inStore(storeId, (tx) =>
      payOrderWithStoreCredit({ storeId, tx }, { orderId, amountPaise: 99_800 }),
    )
    expect(paid.balancePaise).toBe(90_200)
    const [entry] = await owner
      .select()
      .from(storeCreditEntry)
      .where(eq(storeCreditEntry.kind, 'payment'))
    expect(entry).toMatchObject({ orderId, amountPaise: -99_800, reason: 'Paid order #2424' })
    await expect(
      inStore(storeId, (tx) =>
        payOrderWithStoreCredit({ storeId, tx }, { orderId, amountPaise: 99_800 }),
      ),
    ).rejects.toMatchObject({ reason: 'insufficient' })
  })

  it('refuses to pay an order with no customer from store credit', async () => {
    const { storeId, orderId } = await seed(false)
    await expect(
      inStore(storeId, (tx) =>
        payOrderWithStoreCredit({ storeId, tx }, { orderId, amountPaise: 100 }),
      ),
    ).rejects.toMatchObject({ reason: 'invalid' })
  })

  it("puts a refund to store credit on the customer's balance, not a gift card", async () => {
    const { storeId, customerId, orderId } = await seed()
    const [p] = await owner
      .insert(payment)
      .values({
        storeId,
        orderId,
        provider: 'manual',
        providerRef: 'm1',
        status: 'captured',
        amountPaise: 99_800,
      })
      .returning()
    const row = await inStore(storeId, (tx) =>
      refundPayment({ storeId, tx }, null, {
        paymentId: p?.id as string,
        amountPaise: 50_000,
        method: 'store_credit',
        secret: SECRET,
        createdBy: 'owner@waimers.in',
      }),
    )
    expect(row).toMatchObject({ method: 'store_credit', giftCardId: null, status: 'manual' })
    expect(await owner.select().from(giftCard)).toEqual([])
    const account = await inStore(storeId, (tx) => storeCreditOf({ storeId, tx }, customerId))
    expect(account.balancePaise).toBe(50_000)
    expect(account.entries[0]).toMatchObject({ kind: 'refund', orderId })
    const [r] = await owner.select().from(refund)
    expect(r?.amountPaise).toBe(50_000)
  })

  it("credits a guest order's refund to the store's customer with the order's email", async () => {
    const { storeId, customerId, orderId } = await seed(false)
    const paymentId = await capturedPayment(storeId, orderId)
    const row = await inStore(storeId, (tx) =>
      refundPayment({ storeId, tx }, null, {
        paymentId,
        amountPaise: 50_000,
        method: 'store_credit',
        secret: SECRET,
      }),
    )
    expect(row).toMatchObject({ method: 'store_credit', giftCardId: null })
    const account = await inStore(storeId, (tx) => storeCreditOf({ storeId, tx }, customerId))
    expect(account.balancePaise).toBe(50_000)
    expect(await owner.select().from(giftCard)).toEqual([])
    expect(await owner.select().from(customer)).toHaveLength(1)
  })

  it('makes the customer record for a guest email or phone nobody has yet', async () => {
    const byEmail = await guestOrder({ email: 'new@example.com' })
    await refundGuest(byEmail)
    const [made] = await owner.select().from(customer).where(eq(customer.email, 'new@example.com'))
    expect(made).toBeTruthy()
    const account = await inStore(byEmail.storeId, (tx) =>
      storeCreditOf({ storeId: byEmail.storeId, tx }, made?.id as string),
    )
    expect(account.balancePaise).toBe(50_000)

    await resetDb(owner)
    const byPhone = await guestOrder({ phone: '9820012345' })
    await refundGuest(byPhone)
    const rows = await owner.select().from(customer)
    expect(rows).toHaveLength(1)
    expect(rows[0]?.email).toBeNull()
    const credit = await inStore(byPhone.storeId, (tx) =>
      storeCreditOf({ storeId: byPhone.storeId, tx }, rows[0]?.id as string),
    )
    expect(credit.balancePaise).toBe(50_000)
    expect(await owner.select().from(giftCard)).toEqual([])
  })

  it('refuses store credit for an order with no email and no phone; nothing moves', async () => {
    const guest = await guestOrder({})
    await expect(refundGuest(guest)).rejects.toThrow(
      'This order has no customer to hold store credit; refund to the original payment instead.',
    )
    expect(await owner.select().from(refund)).toEqual([])
    expect(await owner.select().from(giftCard)).toEqual([])
    expect(await owner.select().from(storeCreditEntry)).toEqual([])
    expect(await owner.select().from(customer)).toEqual([])
  })
})

async function capturedPayment(storeId: string, orderId: string) {
  const [p] = await owner
    .insert(payment)
    .values({
      storeId,
      orderId,
      provider: 'manual',
      providerRef: `m_${orderId}`,
      status: 'captured',
      amountPaise: 99_800,
    })
    .returning()
  return p?.id as string
}

/** A guest order (no customer) with only the contact given. */
async function guestOrder(contact: { email?: string; phone?: string }) {
  const [s] = await owner.insert(store).values({ slug: 'g', name: 'Waimers' }).returning()
  if (!s) throw new Error('seed')
  const [o] = await owner
    .insert(order)
    .values({
      storeId: s.id,
      number: 7,
      status: 'open',
      subtotalPaise: 99_800,
      totalPaise: 99_800,
      email: contact.email ?? null,
      phone: contact.phone ?? null,
    })
    .returning()
  if (!o) throw new Error('seed')
  return { storeId: s.id, orderId: o.id }
}

const refundGuest = async (g: { storeId: string; orderId: string }) => {
  const paymentId = await capturedPayment(g.storeId, g.orderId)
  return inStore(g.storeId, (tx) =>
    refundPayment({ storeId: g.storeId, tx }, null, {
      paymentId,
      amountPaise: 50_000,
      method: 'store_credit',
      secret: SECRET,
    }),
  )
}
