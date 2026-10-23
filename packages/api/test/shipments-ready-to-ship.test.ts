import { createMerchantAuth } from '@commerce/auth'
import {
  address,
  createDb,
  fulfillmentOrder,
  location,
  order,
  orderLine,
  product,
  store,
  variant,
} from '@commerce/db'
import { resetDb } from '@commerce/db/test'
import { call } from '@orpc/server'
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

async function signIn(email: string) {
  await auth.api.sendVerificationOTP({ body: { email, type: 'sign-in' } })
  const res = await auth.api.signInEmailOTP({
    body: { email, otp: sent.at(-1)?.otp as string },
    asResponse: true,
  })
  return new Headers({ cookie: res.headers.get('set-cookie') ?? '' })
}

async function merchant(email: string, slug: string) {
  const headers = await signIn(email)
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

async function seedAddress(storeId: string, pincode = '110001') {
  const [a] = await owner
    .insert(address)
    .values({
      storeId,
      name: 'Priya Sharma',
      line1: '1 MG Road',
      city: 'Delhi',
      stateCode: 'DL',
      pincode,
      phone: '9999999999',
    })
    .returning()
  return a?.id as string
}

async function seedOrderWithLines(
  storeId: string,
  overrides: Partial<typeof order.$inferInsert>,
  lines: { quantity: number; preorder?: boolean }[],
) {
  const [p] = await owner
    .insert(product)
    .values({ storeId, handle: `p-${crypto.randomUUID()}`, title: 'Pad' })
    .returning()
  const [v] = await owner
    .insert(variant)
    .values({ storeId, productId: p?.id as string, title: 'Default', pricePaise: 1000 })
    .returning()
  const addressId = await seedAddress(storeId)
  const [o] = await owner
    .insert(order)
    .values({
      storeId,
      number: overrides.number ?? 1,
      subtotalPaise: 1000,
      totalPaise: 1000,
      shippingAddressId: addressId,
      ...overrides,
    })
    .returning()
  const id = o?.id as string
  for (const line of lines) {
    await owner.insert(orderLine).values({
      storeId,
      orderId: id,
      variantId: v?.id as string,
      quantity: line.quantity,
      unitPricePaise: 1000,
      preorder: line.preorder ?? false,
    })
  }
  return id
}

beforeEach(async () => {
  await resetDb(owner)
  sent.length = 0
})
afterAll(async () => {
  await owner.$client.end()
  await app.$client.end()
})

describe('shipments.readyToShip', () => {
  it('lists only paid, unfulfilled/partial, non-cancelled, non-held orders', async () => {
    const m = await merchant('ready@example.com', 'ready')
    const shouldShow = await seedOrderWithLines(
      m.storeId,
      { number: 1, paymentStatus: 'paid', fulfillmentStatus: 'unfulfilled' },
      [{ quantity: 2 }, { quantity: 3 }],
    )
    const partial = await seedOrderWithLines(
      m.storeId,
      { number: 2, paymentStatus: 'partially_paid', fulfillmentStatus: 'partially_fulfilled' },
      [{ quantity: 1, preorder: true }],
    )
    await seedOrderWithLines(
      m.storeId,
      { number: 3, paymentStatus: 'unpaid', fulfillmentStatus: 'unfulfilled' },
      [{ quantity: 1 }],
    )
    await seedOrderWithLines(
      m.storeId,
      { number: 4, paymentStatus: 'paid', fulfillmentStatus: 'fulfilled' },
      [{ quantity: 1 }],
    )
    await seedOrderWithLines(
      m.storeId,
      { number: 5, paymentStatus: 'paid', fulfillmentStatus: 'unfulfilled', status: 'cancelled' },
      [{ quantity: 1 }],
    )
    await seedOrderWithLines(
      m.storeId,
      {
        number: 6,
        paymentStatus: 'paid',
        fulfillmentStatus: 'unfulfilled',
        tags: ['hold'],
      },
      [{ quantity: 1 }],
    )
    // Hold fulfilment (an automation's step): its parcel is held until released.
    const held = await seedOrderWithLines(
      m.storeId,
      { number: 7, paymentStatus: 'paid', fulfillmentStatus: 'unfulfilled' },
      [{ quantity: 1 }],
    )
    const [loc] = await owner
      .insert(location)
      .values({ storeId: m.storeId, name: 'Main' })
      .returning()
    await owner.insert(fulfillmentOrder).values({
      storeId: m.storeId,
      orderId: held,
      locationId: loc?.id as string,
      heldAt: new Date(),
      holdReason: 'Risky COD',
    })

    const r = await call(
      appRouter.shipments.readyToShip,
      { page: 1, perPage: 50 },
      { context: m.ctx },
    )
    expect(r.total).toBe(2)
    const ids = r.items.map((i) => i.orderId).sort()
    expect(ids).toEqual([partial, shouldShow].sort())

    const full = r.items.find((i) => i.orderId === shouldShow)
    expect(full).toMatchObject({ orderNumber: 1, itemsCount: 5, isPreorder: false, city: 'Delhi' })

    const preorderRow = r.items.find((i) => i.orderId === partial)
    expect(preorderRow).toMatchObject({ orderNumber: 2, itemsCount: 1, isPreorder: true })
  })

  it('paginates and never shows another store’s orders', async () => {
    const a = await merchant('ready-a@example.com', 'ready-a')
    const b = await merchant('ready-b@example.com', 'ready-b')
    for (let i = 1; i <= 3; i++) {
      await seedOrderWithLines(
        a.storeId,
        { number: i, paymentStatus: 'paid', fulfillmentStatus: 'unfulfilled' },
        [{ quantity: 1 }],
      )
    }
    const page1 = await call(
      appRouter.shipments.readyToShip,
      { page: 1, perPage: 2 },
      { context: a.ctx },
    )
    expect(page1.total).toBe(3)
    expect(page1.items).toHaveLength(2)
    const page2 = await call(
      appRouter.shipments.readyToShip,
      { page: 2, perPage: 2 },
      { context: a.ctx },
    )
    expect(page2.items).toHaveLength(1)

    const crossStore = await call(
      appRouter.shipments.readyToShip,
      { page: 1, perPage: 50 },
      { context: b.ctx },
    )
    expect(crossStore.total).toBe(0)
  })
})
