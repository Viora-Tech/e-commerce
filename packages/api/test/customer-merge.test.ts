import { createMerchantAuth } from '@commerce/auth'
import {
  address,
  createDb,
  customer,
  customerAddress,
  order,
  orderLine,
  product,
  store,
  variant,
} from '@commerce/db'
import { resetDb } from '@commerce/db/test'
import { call } from '@orpc/server'
import { eq } from 'drizzle-orm'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import type { ApiContext } from '../src/context'
import { appRouter } from '../src/routers/_app'

const owner = createDb(process.env.DATABASE_URL_OWNER as string)
const app = createDb(process.env.DATABASE_URL as string)
const sent: { otp: string }[] = []
const auth = createMerchantAuth({
  db: app,
  baseURL: 'http://localhost:3200',
  secret: 'test-secret-test-secret-test-secret-1234',
  sendOtp: async (m) => {
    sent.push(m)
  },
})

async function merchant(email: string, slug: string) {
  await auth.api.sendVerificationOTP({ body: { email, type: 'sign-in' } })
  const res = await auth.api.signInEmailOTP({
    body: { email, otp: sent.at(-1)?.otp as string },
    asResponse: true,
  })
  const headers = new Headers({ cookie: res.headers.get('set-cookie') ?? '' })
  const org = await auth.api.createOrganization({ headers, body: { name: slug, slug } })
  await auth.api.setActiveOrganization({ headers, body: { organizationId: org?.id as string } })
  const [s] = await owner
    .insert(store)
    .values({ slug, name: slug, organizationId: org?.id as string })
    .returning()
  return {
    ctx: { db: app, auth, headers, notifications: { add: async () => undefined } } as ApiContext,
    storeId: s?.id as string,
  }
}

/** #2445: the order sits on the old record; the shopper signs in with the email staff typed. */
async function seedTwoRecords(storeId: string) {
  const [old, signedIn] = await owner
    .insert(customer)
    .values([
      { storeId, name: 'Rudra', email: 'valorantrudrra@gmail.com' },
      { storeId, email: 'vorajazvir@gmail.com' },
    ])
    .returning()
  const [o] = await owner
    .insert(order)
    .values({
      storeId,
      number: 2445,
      customerId: old?.id,
      email: 'valorantrudrra@gmail.com',
      status: 'open',
      subtotalPaise: 100000,
      totalPaise: 100000,
    })
    .returning()
  return { oldId: old?.id as string, newId: signedIn?.id as string, orderId: o?.id as string }
}

/** An imported Shopify order with one line, shipping to Bhopal. */
async function seedImported(storeId: string) {
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
  const [p] = await owner
    .insert(product)
    .values({ storeId, title: 'Tee', handle: 'tee' })
    .returning()
  const [v] = await owner
    .insert(variant)
    .values({ storeId, productId: p?.id as string, title: 'M', sku: 'TEE', pricePaise: 90000 })
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
      status: 'open',
      importedFrom: 'shopify',
      subtotalPaise: 90000,
      totalPaise: 90000,
    })
    .returning()
  const [line] = await owner
    .insert(orderLine)
    .values({
      storeId,
      orderId: o?.id as string,
      variantId: v?.id as string,
      title: 'Tee',
      quantity: 1,
      unitPricePaise: 90000,
    })
    .returning()
  return {
    customerId: c?.id as string,
    orderId: o?.id as string,
    lineId: line?.id as string,
    place,
  }
}

beforeEach(async () => {
  await resetDb(owner)
  sent.length = 0
})
afterAll(async () => {
  await owner.$client.end()
  await app.$client.end()
})

describe('customers.merge', () => {
  it('moves the order onto the signed-in record and hides the other one', async () => {
    const a = await merchant('a@example.com', 'store-a')
    const { oldId, newId } = await seedTwoRecords(a.storeId)

    const preview = await call(
      appRouter.customers.previewMerge,
      { keepId: newId, mergeId: oldId },
      { context: a.ctx },
    )
    expect(preview.moves.orders).toBe(1)

    await call(
      appRouter.customers.merge,
      { keepId: newId, mergeId: oldId, keep: { name: 'merged' } },
      { context: a.ctx },
    )
    const [o] = await owner.select().from(order)
    expect(o?.customerId).toBe(newId)
    const kept = await call(appRouter.customers.get, { id: newId }, { context: a.ctx })
    expect(kept?.name).toBe('Rudra')
    expect(kept?.orders).toHaveLength(1)
    const list = await call(appRouter.customers.list, {}, { context: a.ctx })
    expect(list.items.map((c) => c.id)).toEqual([newId])
    const stub = await call(appRouter.customers.get, { id: oldId }, { context: a.ctx })
    expect(stub?.mergedIntoId).toBe(newId)

    await expect(
      call(appRouter.customers.merge, { keepId: newId, mergeId: oldId }, { context: a.ctx }),
    ).rejects.toThrow('already merged')
    await expect(
      call(appRouter.customers.merge, { keepId: newId, mergeId: newId }, { context: a.ctx }),
    ).rejects.toThrow('different customer')
  })
})

describe('orders.changeCustomer and the contact edit', () => {
  it('moves an order to another customer', async () => {
    const a = await merchant('a@example.com', 'store-a')
    const { newId, orderId } = await seedTwoRecords(a.storeId)
    const result = await call(
      appRouter.orders.changeCustomer,
      { orderId, customerId: newId },
      { context: a.ctx },
    )
    expect(result.changed).toBe(true)
    const [o] = await owner.select().from(order)
    expect(o?.customerId).toBe(newId)
  })

  it('offers the email owner and moves the order only when asked', async () => {
    const a = await merchant('a@example.com', 'store-a')
    const { oldId, newId, orderId } = await seedTwoRecords(a.storeId)
    const found = await call(
      appRouter.orders.findEmailOwner,
      { orderId, email: 'vorajazvir@gmail.com' },
      { context: a.ctx },
    )
    expect(found?.id).toBe(newId)

    const contact = {
      orderId,
      name: 'Jazvir',
      email: 'vorajazvir@gmail.com',
      phone: null,
      address: null,
    }
    // Default: only the order's email changes; it stays on the old record.
    await call(appRouter.orders.updateContact, contact, { context: a.ctx })
    let [o] = await owner.select().from(order)
    expect(o?.email).toBe('vorajazvir@gmail.com')
    expect(o?.customerId).toBe(oldId)

    const moved = await call(
      appRouter.orders.updateContact,
      { ...contact, moveToEmailOwner: true },
      { context: a.ctx },
    )
    expect(moved.movedToCustomerId).toBe(newId)
    ;[o] = await owner.select().from(order)
    expect(o?.customerId).toBe(newId)
  })

  it('corrects an imported order’s phone and address but still refuses a line edit', async () => {
    const a = await merchant('a@example.com', 'store-a')
    const { customerId, orderId, lineId, place } = await seedImported(a.storeId)

    await call(
      appRouter.orders.updateContact,
      {
        orderId,
        name: 'Priya',
        email: 'priya@w.in',
        phone: '7560847217',
        address: place,
        alsoUpdateCustomer: false,
      },
      { context: a.ctx },
    )
    const [o] = await owner.select().from(order).where(eq(order.id, orderId))
    expect(o?.phone).toBe('7560847217')
    const [snapshot] = await owner
      .select()
      .from(address)
      .where(eq(address.id, o?.shippingAddressId as string))
    expect(snapshot?.phone).toBe('7560847217')
    const [c] = await owner.select().from(customer).where(eq(customer.id, customerId))
    expect(c?.phone).toBe('7560847219')
    const [saved] = await owner.select().from(customerAddress)
    expect(saved?.phone).toBe('7560847219')

    await expect(
      call(
        appRouter.orders.edit,
        { orderId, lines: [{ lineId, quantity: 2 }] },
        { context: a.ctx },
      ),
    ).rejects.toThrow('This order was imported')
    const [after] = await owner.select().from(orderLine).where(eq(orderLine.id, lineId))
    expect(after?.quantity).toBe(1)
  })
})

describe('customers.update email', () => {
  it('changes the email, and refuses one another customer has', async () => {
    const a = await merchant('a@example.com', 'store-a')
    const { oldId, newId } = await seedTwoRecords(a.storeId)
    await call(
      appRouter.customers.update,
      { id: oldId, email: 'Rudra.New@Gmail.com' },
      { context: a.ctx },
    )
    const [c] = await owner.select().from(customer).where(eq(customer.id, oldId))
    expect(c?.email).toBe('rudra.new@gmail.com')

    await expect(
      call(
        appRouter.customers.update,
        { id: oldId, email: 'VoraJazvir@gmail.com' },
        {
          context: a.ctx,
        },
      ),
    ).rejects.toMatchObject({ code: 'CONFLICT', data: { field: 'email', existingId: newId } })
    // Its own email again is fine.
    await call(
      appRouter.customers.update,
      { id: newId, email: 'vorajazvir@gmail.com' },
      {
        context: a.ctx,
      },
    )
  })
})
