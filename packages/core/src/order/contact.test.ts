/** SOURCE OF TRUTH: order contact edits — tests updateOrderContact's no-address path, billing edits and store isolation */
import {
  address,
  createDb,
  customer,
  customerAddress,
  notification,
  order,
  orderNote,
  outboxEvent,
  store,
  withStore,
} from '@commerce/db'
import { resetDb } from '@commerce/db/test'
import { eq } from 'drizzle-orm'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import {
  IMPORTED_TAX_LOCKED,
  InvalidOrderContact,
  OrderNotFound,
  updateOrderContact,
} from './contact'

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

  it('bills a separate address with a company and GSTIN, then back to the shipping address', async () => {
    const { storeId, orderId } = await seed('a')
    const edit = (billing: Parameters<typeof updateOrderContact>[1]['billing']) =>
      withStore(app, storeId, (tx) =>
        updateOrderContact(
          { storeId, tx },
          {
            orderId,
            name: 'Ravi',
            email: 'ravi@a.in',
            phone: '9876543210',
            address: null,
            alsoUpdateCustomer: false,
            author: 'staff@a.in',
            billing,
          },
        ),
      )
    await edit({
      address: {
        name: 'Mehta Traders',
        line1: '12 MG Road',
        city: 'Pune',
        stateCode: 'MH',
        pincode: '411001',
      },
      businessName: 'Mehta Traders',
      gstin: '27aapfu0939f1zv',
    })
    const [billed] = await owner.select().from(order).where(eq(order.id, orderId))
    expect(billed?.buyerGstin).toBe('27AAPFU0939F1ZV')
    expect(billed?.buyerBusinessName).toBe('Mehta Traders')
    const billId = billed?.billingAddressId as string
    const [bill] = await owner.select().from(address).where(eq(address.id, billId))
    expect(bill?.city).toBe('Pune')

    await edit({ address: null, businessName: null, gstin: null })
    const [back] = await owner.select().from(order).where(eq(order.id, orderId))
    expect(back?.billingAddressId).toBeNull()
    expect(back?.buyerGstin).toBeNull()
    // The old billing snapshot is no one's any more.
    expect(await owner.select().from(address).where(eq(address.id, billId))).toHaveLength(0)
  })

  it('rejects a GSTIN with a typo', async () => {
    const { storeId, orderId } = await seed('a')
    await expect(
      withStore(app, storeId, (tx) =>
        updateOrderContact(
          { storeId, tx },
          {
            orderId,
            name: 'Ravi',
            email: null,
            phone: null,
            address: null,
            alsoUpdateCustomer: false,
            author: 'staff@a.in',
            billing: { address: null, businessName: null, gstin: '27AAPFU0939F1ZX' },
          },
        ),
      ),
    ).rejects.toBeInstanceOf(InvalidOrderContact)
  })

  it('changes only the order (imported #2279): customer, saved address and shopper untouched', async () => {
    const [s] = await owner.insert(store).values({ slug: 'w', name: 'w' }).returning()
    const storeId = s?.id as string
    const [c] = await owner
      .insert(customer)
      .values({ storeId, name: 'Priya', email: 'priya@w.in', phone: '7560847219' })
      .returning()
    const place = { line1: '5 Lake Road', city: 'Bhopal', stateCode: 'MP', pincode: '462001' }
    await owner.insert(customerAddress).values({
      storeId,
      customerId: c?.id as string,
      name: 'Priya',
      phone: '7560847219',
      isDefault: true,
      ...place,
    })
    const [a] = await owner
      .insert(address)
      .values({ storeId, name: 'Priya', phone: '7560847219', ...place })
      .returning()
    const [o] = await owner
      .insert(order)
      .values({
        storeId,
        number: 2279,
        customerId: c?.id,
        email: 'priya@w.in',
        phone: '7560847219',
        shippingAddressId: a?.id,
        status: 'completed',
        importedFrom: 'shopify',
        buyerGstin: '27AAPFU0939F1ZV',
        subtotalPaise: 90000,
        totalPaise: 90000,
      })
      .returning()
    const orderId = o?.id as string

    const edit = (gstin: string) =>
      withStore(app, storeId, (tx) =>
        updateOrderContact(
          { storeId, tx },
          {
            orderId,
            name: 'Priya',
            email: 'priya@w.in',
            phone: '7560847217',
            address: place,
            alsoUpdateCustomer: false,
            author: 'owner@w.in',
            lockTax: true,
            billing: { address: null, businessName: null, gstin },
          },
        ),
      )
    // An imported order's GSTIN is its tax record: a change is refused, nothing written.
    await expect(edit('29AAPFU0939F1ZV')).rejects.toThrow(IMPORTED_TAX_LOCKED)

    const result = await edit('27AAPFU0939F1ZV')
    expect(result.changed).toBe(true)
    const [after] = await owner.select().from(order).where(eq(order.id, orderId))
    expect(after?.phone).toBe('7560847217')
    const [snapshot] = await owner
      .select()
      .from(address)
      .where(eq(address.id, after?.shippingAddressId as string))
    expect(snapshot?.phone).toBe('7560847217')
    // The customer and their saved address keep the old number.
    const [cu] = await owner
      .select()
      .from(customer)
      .where(eq(customer.id, c?.id as string))
    expect(cu?.phone).toBe('7560847219')
    const book = await owner.select().from(customerAddress)
    expect(book.map((b) => b.phone)).toEqual(['7560847219'])
    // Nothing reaches the shopper, and no app hears of a customer change.
    expect(await owner.select().from(notification)).toHaveLength(0)
    expect(await owner.select().from(outboxEvent)).toHaveLength(0)
    const [note] = await owner.select().from(orderNote).where(eq(orderNote.orderId, orderId))
    expect(note?.body).toBe('Phone changed from 7560847219 to 7560847217')
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
