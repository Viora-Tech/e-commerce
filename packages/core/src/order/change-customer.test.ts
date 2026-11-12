/** SOURCE OF TRUTH: moving an order to another customer — tests moveOrderToCustomer (timelines, discount uses, refusals) and emailOwnerForOrder */
import {
  createDb,
  customer,
  customerNote,
  discount,
  discountUsage,
  order,
  orderNote,
  store,
  storeCreditEntry,
  withStore,
} from '@commerce/db'
import { resetDb } from '@commerce/db/test'
import { eq } from 'drizzle-orm'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { emailOwnerForOrder, moveOrderToCustomer } from './change-customer'

const owner = createDb(process.env.DATABASE_URL_OWNER as string)
const app = createDb(process.env.DATABASE_URL as string)

afterAll(async () => {
  await owner.$client.end()
  await app.$client.end()
})

beforeEach(async () => {
  await resetDb(owner)
})

/** Order #2445 on the old record; the shopper signs in with the new email (a second record). */
async function seed() {
  const [s] = await owner.insert(store).values({ slug: 'w', name: 'w' }).returning()
  const storeId = s?.id as string
  const [old, signedIn] = await owner
    .insert(customer)
    .values([
      { storeId, name: 'Rudra', email: 'valorantrudrra@gmail.com' },
      { storeId, name: null, email: 'vorajazvir@gmail.com' },
    ])
    .returning()
  const [o] = await owner
    .insert(order)
    .values({
      storeId,
      number: 2445,
      customerId: old?.id,
      email: 'vorajazvir@gmail.com',
      status: 'open',
      subtotalPaise: 100000,
      totalPaise: 100000,
    })
    .returning()
  return {
    storeId,
    oldId: old?.id as string,
    newId: signedIn?.id as string,
    orderId: o?.id as string,
  }
}

const ctxFor =
  (storeId: string) =>
  <T>(fn: (ctx: { storeId: string; tx: never }) => Promise<T>) =>
    withStore(app, storeId, (tx) => fn({ storeId, tx: tx as never }))

describe('moveOrderToCustomer', () => {
  it('moves the order and its discount use, with a line on the order and both customers', async () => {
    const { storeId, oldId, newId, orderId } = await seed()
    const [d] = await owner
      .insert(discount)
      .values({ storeId, code: 'HELLO', method: 'percent', value: 10, title: 'Hello' })
      .returning()
    await owner
      .insert(discountUsage)
      .values({ storeId, discountId: d?.id as string, orderId, customerId: oldId, amountPaise: 1 })
    const run = ctxFor(storeId)
    const result = await run((ctx) =>
      moveOrderToCustomer(ctx, { orderId, customerId: newId, author: 'owner@w.in' }),
    )
    expect(result).toEqual({ ok: true, fromCustomerId: oldId, toCustomerId: newId, changed: true })
    const [o] = await owner.select().from(order).where(eq(order.id, orderId))
    expect(o?.customerId).toBe(newId)
    // The order keeps the email it has.
    expect(o?.email).toBe('vorajazvir@gmail.com')
    const [use] = await owner.select().from(discountUsage)
    expect(use?.customerId).toBe(newId)
    const [note] = await owner.select().from(orderNote).where(eq(orderNote.orderId, orderId))
    expect(note?.body).toBe('Customer changed from Rudra to vorajazvir@gmail.com')
    const notes = await owner.select().from(customerNote)
    expect(notes.map((n) => [n.customerId, n.body]).sort()).toEqual(
      [
        [newId, 'Order #2445 moved here from Rudra'],
        [oldId, 'Order #2445 moved to vorajazvir@gmail.com'],
      ].sort(),
    )

    // Again: nothing to do.
    const again = await run((ctx) =>
      moveOrderToCustomer(ctx, { orderId, customerId: newId, author: 'owner@w.in' }),
    )
    expect(again.ok && again.changed).toBe(false)
  })

  it('refuses an erased or merged customer and an order paid with store credit', async () => {
    const { storeId, oldId, newId, orderId } = await seed()
    const run = ctxFor(storeId)
    await owner.update(customer).set({ mergedIntoId: oldId }).where(eq(customer.id, newId))
    expect(
      await run((ctx) => moveOrderToCustomer(ctx, { orderId, customerId: newId, author: 'a' })),
    ).toEqual({ ok: false, reason: 'customer_not_found' })
    await owner.update(customer).set({ mergedIntoId: null }).where(eq(customer.id, newId))

    await owner.insert(storeCreditEntry).values({
      storeId,
      customerId: oldId,
      amountPaise: -500,
      balanceAfterPaise: 0,
      kind: 'payment',
      reason: 'Paid order #2445',
      orderId,
    })
    expect(
      await run((ctx) => moveOrderToCustomer(ctx, { orderId, customerId: newId, author: 'a' })),
    ).toEqual({ ok: false, reason: 'store_credit' })
  })

  it('finds the other customer who has an email, never the order’s own', async () => {
    const { storeId, newId, orderId } = await seed()
    const run = ctxFor(storeId)
    const found = await run((ctx) =>
      emailOwnerForOrder(ctx, { orderId, email: ' VoraJazvir@gmail.com ' }),
    )
    expect(found?.id).toBe(newId)
    expect(
      await run((ctx) => emailOwnerForOrder(ctx, { orderId, email: 'valorantrudrra@gmail.com' })),
    ).toBeNull()
    expect(
      await run((ctx) => emailOwnerForOrder(ctx, { orderId, email: 'nobody@x.in' })),
    ).toBeNull()
  })
})
