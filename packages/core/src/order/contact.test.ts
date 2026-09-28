/** SOURCE OF TRUTH: order contact edits — tests updateOrderContact's no-address path and store isolation */
import { createDb, customer, order, orderNote, store, withStore } from '@commerce/db'
import { resetDb } from '@commerce/db/test'
import { eq } from 'drizzle-orm'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { OrderNotFound, updateOrderContact } from './contact'

const owner = createDb(process.env.DATABASE_URL_OWNER as string)
const app = createDb(process.env.DATABASE_URL as string)

afterAll(async () => {
  await owner.$client.end()
  await app.$client.end()
})

beforeEach(async () => {
  await resetDb(owner)
})

async function seed(slug: string) {
  const [s] = await owner.insert(store).values({ slug, name: slug }).returning()
  const [c] = await owner
    .insert(customer)
    .values({ storeId: s?.id as string, name: 'Ravi', email: `ravi@${slug}.in` })
    .returning()
  // A gift card order: nothing to ship, so no address.
  const [o] = await owner
    .insert(order)
    .values({
      storeId: s?.id as string,
      number: 1,
      customerId: c?.id,
      email: `ravi@${slug}.in`,
      status: 'open',
      subtotalPaise: 50000,
      totalPaise: 50000,
    })
    .returning()
  return { storeId: s?.id as string, customerId: c?.id as string, orderId: o?.id as string }
}

describe('updateOrderContact', () => {
  it('puts the name on the customer when the order has no address', async () => {
    const { storeId, customerId, orderId } = await seed('a')
    const result = await withStore(app, storeId, (tx) =>
      updateOrderContact(
        { storeId, tx },
        {
          orderId,
          name: 'Ravi Iyer',
          email: 'ravi@a.in',
          phone: null,
          address: null,
          alsoUpdateCustomer: true,
          author: 'staff@a.in',
        },
      ),
    )
    expect(result.changed).toBe(true)
    const [c] = await owner.select().from(customer).where(eq(customer.id, customerId))
    expect(c?.name).toBe('Ravi Iyer')
    const [o] = await owner.select().from(order).where(eq(order.id, orderId))
    expect(o?.shippingAddressId).toBeNull()
    const [note] = await owner.select().from(orderNote).where(eq(orderNote.orderId, orderId))
    expect(note?.body).toBe('Name changed from Ravi to Ravi Iyer')
  })

  it("does not find another store's order", async () => {
    const a = await seed('a')
    const b = await seed('b')
    await expect(
      withStore(app, b.storeId, (tx) =>
        updateOrderContact(
          { storeId: b.storeId, tx },
          {
            orderId: a.orderId,
            name: 'X',
            email: null,
            phone: null,
            address: null,
            alsoUpdateCustomer: false,
            author: 'staff@b.in',
          },
        ),
      ),
    ).rejects.toBeInstanceOf(OrderNotFound)
  })
})
