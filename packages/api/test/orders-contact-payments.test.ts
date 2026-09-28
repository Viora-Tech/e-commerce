import { createMerchantAuth } from '@commerce/auth'
import {
  address,
  createDb,
  customer,
  customerAddress,
  order,
  orderNote,
  payment,
  store,
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

/** A customer with one open, unpaid order shipping to Pune. */
async function seedOrder(storeId: string, number = 1) {
  const [c] = await owner
    .insert(customer)
    .values({ storeId, name: 'Asha Menon', email: `asha${number}@example.com` })
    .returning()
  const [a] = await owner
    .insert(address)
    .values({
      storeId,
      name: 'Asha Menon',
      line1: '12 MG Road',
      city: 'Pune',
      stateCode: 'MH',
      pincode: '411001',
      phone: '9876543210',
    })
    .returning()
  const [o] = await owner
    .insert(order)
    .values({
      storeId,
      number,
      customerId: c?.id,
      email: `asha${number}@example.com`,
      phone: '9876543210',
      shippingAddressId: a?.id,
      status: 'open',
      paymentMethod: 'manual',
      subtotalPaise: 150000,
      totalPaise: 150000,
    })
    .returning()
  return { customerId: c?.id as string, addressId: a?.id as string, orderId: o?.id as string }
}

const newAddress = {
  line1: '4 Park Street',
  line2: 'Near the metro',
  city: 'Kolkata',
  stateCode: 'WB',
  pincode: '700016',
}

beforeEach(async () => {
  await resetDb(owner)
  sent.length = 0
})
afterAll(async () => {
  await owner.$client.end()
  await app.$client.end()
})

describe('orders.collectPayment with how it was paid', () => {
  it('records the method, UTR and day on the payment and marks the order paid', async () => {
    const a = await merchant('a@example.com', 'store-a')
    const { orderId } = await seedOrder(a.storeId)

    await call(
      appRouter.orders.collectPayment,
      {
        orderId,
        amountPaise: 150000,
        paidWith: 'bank_transfer',
        reference: 'UTR998877',
        receivedOn: '2026-09-27',
      },
      { context: a.ctx },
    )

    const [p] = await owner.select().from(payment).where(eq(payment.orderId, orderId))
    expect(p).toMatchObject({ status: 'captured', amountPaise: 150000 })
    expect(p?.checkoutSession).toMatchObject({
      collected: {
        method: 'bank_transfer',
        reference: 'UTR998877',
        receivedOn: '2026-09-27',
        recordedBy: 'a@example.com',
      },
    })
    const [o] = await owner.select().from(order).where(eq(order.id, orderId))
    expect(o?.paymentStatus).toBe('paid')
  })

  it('keeps the gateway session on a pending attempt it captures', async () => {
    const a = await merchant('a@example.com', 'store-a')
    const { orderId } = await seedOrder(a.storeId)
    const session = { kind: 'manual', provider: 'manual', providerRef: 'r1', instructions: {} }
    await owner.insert(payment).values({
      storeId: a.storeId,
      orderId,
      provider: 'manual',
      providerRef: 'r1',
      status: 'pending',
      amountPaise: 150000,
      checkoutSession: session,
    })

    await call(
      appRouter.orders.collectPayment,
      { orderId, amountPaise: 150000, paidWith: 'upi' },
      { context: a.ctx },
    )

    const [p] = await owner.select().from(payment).where(eq(payment.orderId, orderId))
    expect(p?.status).toBe('captured')
    expect(p?.checkoutSession).toMatchObject({ ...session, collected: { method: 'upi' } })
  })

  it('refuses to record more than is left to pay', async () => {
    const a = await merchant('a@example.com', 'store-a')
    const { orderId } = await seedOrder(a.storeId)
    await expect(
      call(
        appRouter.orders.collectPayment,
        { orderId, amountPaise: 10_000_000, paidWith: 'cash' },
        { context: a.ctx },
      ),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' })
    expect(await owner.select().from(payment).where(eq(payment.orderId, orderId))).toEqual([])
  })

  it('rejects a date that is not a real day', async () => {
    const a = await merchant('a@example.com', 'store-a')
    const { orderId } = await seedOrder(a.storeId)
    await expect(
      call(
        appRouter.orders.collectPayment,
        { orderId, amountPaise: 150000, paidWith: 'cash', receivedOn: '2026-02-30' },
        { context: a.ctx },
      ),
    ).rejects.toThrow()
  })

  it('shows manual payments in "Payments by method", grouped by the method recorded', async () => {
    const a = await merchant('a@example.com', 'store-a')
    const first = await seedOrder(a.storeId, 1)
    const second = await seedOrder(a.storeId, 2)
    const third = await seedOrder(a.storeId, 3)
    for (const [o, paidWith] of [
      [first, 'cash'],
      [second, 'cash'],
      [third, 'upi'],
    ] as const) {
      await call(
        appRouter.orders.collectPayment,
        { orderId: o.orderId, amountPaise: 150000, paidWith },
        { context: a.ctx },
      )
    }
    await owner.insert(payment).values({
      storeId: a.storeId,
      orderId: third.orderId,
      provider: 'razorpay',
      providerRef: 'pay_1',
      status: 'captured',
      amountPaise: 5000,
      multiCapture: true,
    })

    const report = await call(
      appRouter.analytics.report,
      { slug: 'payments-by-method', range: { key: 'today' } },
      { context: a.ctx },
    )
    const byMethod = Object.fromEntries(report.rows.map((r) => [r.key, r.values]))
    expect(byMethod.cash).toMatchObject({ payments: 2, amount: 300000, recorded: 'by_hand' })
    expect(byMethod.upi).toMatchObject({ payments: 1, amount: 150000, recorded: 'by_hand' })
    expect(byMethod.razorpay).toMatchObject({ payments: 1, amount: 5000, recorded: 'automatic' })
    expect(report.totals).toMatchObject({ payments: 4, amount: 455000 })
    expect(report.rows[0]?.key).toBe('cash')

    const catalogue = await call(appRouter.analytics.reports, undefined, { context: a.ctx })
    expect(catalogue.find((r) => r.slug === 'payments-by-method')).toMatchObject({
      category: 'finance',
      available: true,
    })
  })
})

describe('orders.updateContact', () => {
  it('moves the order to a new address, drops the orphaned old one and logs the change', async () => {
    const a = await merchant('a@example.com', 'store-a')
    const { orderId, addressId, customerId } = await seedOrder(a.storeId)

    const result = await call(
      appRouter.orders.updateContact,
      {
        orderId,
        name: 'Asha M',
        email: 'Asha.New@Example.com',
        phone: '+91 91234 56789',
        address: newAddress,
        alsoUpdateCustomer: false,
      },
      { context: a.ctx },
    )
    expect(result.changed).toBe(true)

    const [o] = await owner.select().from(order).where(eq(order.id, orderId))
    expect(o).toMatchObject({ email: 'asha.new@example.com', phone: '9123456789' })
    expect(o?.shippingAddressId).not.toBe(addressId)
    const [moved] = await owner
      .select()
      .from(address)
      .where(eq(address.id, o?.shippingAddressId as string))
    expect(moved).toMatchObject({ ...newAddress, name: 'Asha M', phone: '9123456789' })
    // The old snapshot belonged to no order any more; the note keeps what it said, and an
    // erasure blanks that note (a stray row would have outlived it).
    expect(await owner.select().from(address).where(eq(address.id, addressId))).toEqual([])

    const notes = await owner.select().from(orderNote).where(eq(orderNote.orderId, orderId))
    expect(notes).toHaveLength(1)
    expect(notes[0]?.author).toBe('a@example.com')
    expect(notes[0]?.body).toContain('Email changed from asha1@example.com to asha.new@example.com')
    expect(notes[0]?.body).toContain('Shipping address changed from 12 MG Road, Pune, MH 411001')

    // The customer's book is untouched without the box ticked.
    const book = await owner
      .select()
      .from(customerAddress)
      .where(eq(customerAddress.customerId, customerId))
    expect(book).toHaveLength(0)
  })

  it("also saves the address as the customer's default when asked", async () => {
    const a = await merchant('a@example.com', 'store-a')
    const { orderId, customerId } = await seedOrder(a.storeId)

    await call(
      appRouter.orders.updateContact,
      {
        orderId,
        name: 'Asha Menon',
        email: 'asha1@example.com',
        phone: '9876543210',
        address: newAddress,
        alsoUpdateCustomer: true,
      },
      { context: a.ctx },
    )

    const book = await owner
      .select()
      .from(customerAddress)
      .where(eq(customerAddress.customerId, customerId))
    expect(book).toHaveLength(1)
    expect(book[0]).toMatchObject({ city: 'Kolkata', isDefault: true })
    const [c] = await owner.select().from(customer).where(eq(customer.id, customerId))
    expect(c?.defaultAddress).toMatchObject({ city: 'Kolkata', pincode: '700016' })
  })

  it('writes nothing to the timeline when nothing changed', async () => {
    const a = await merchant('a@example.com', 'store-a')
    const { orderId, addressId } = await seedOrder(a.storeId)
    const result = await call(
      appRouter.orders.updateContact,
      {
        orderId,
        name: 'Asha Menon',
        email: 'asha1@example.com',
        phone: '9876543210',
        // The dialog sends a blank second line as null.
        address: {
          line1: '12 MG Road',
          line2: null,
          city: 'Pune',
          stateCode: 'MH',
          pincode: '411001',
        },
        alsoUpdateCustomer: false,
      },
      { context: a.ctx },
    )
    expect(result.changed).toBe(false)
    const [o] = await owner.select().from(order).where(eq(order.id, orderId))
    expect(o?.shippingAddressId).toBe(addressId)
    expect(await owner.select().from(orderNote)).toHaveLength(0)
  })

  it('names the bad field when the address does not validate', async () => {
    const a = await merchant('a@example.com', 'store-a')
    const { orderId } = await seedOrder(a.storeId)
    await expect(
      call(
        appRouter.orders.updateContact,
        {
          orderId,
          name: 'Asha',
          email: null,
          phone: '9876543210',
          address: { ...newAddress, pincode: '012345' },
          alsoUpdateCustomer: false,
        },
        { context: a.ctx },
      ),
    ).rejects.toMatchObject({ data: { errors: { pincode: 'Enter a six digit PIN code' } } })
  })
})

describe('another store', () => {
  it("can never edit this store's order contact or customer addresses", async () => {
    const a = await merchant('a@example.com', 'store-a')
    const b = await merchant('b@example.com', 'store-b')
    const { orderId, addressId, customerId } = await seedOrder(a.storeId)
    const [saved] = await owner
      .insert(customerAddress)
      .values({
        storeId: a.storeId,
        customerId,
        name: 'Asha Menon',
        line1: '12 MG Road',
        city: 'Pune',
        stateCode: 'MH',
        pincode: '411001',
        phone: '9876543210',
        isDefault: true,
      })
      .returning()

    await expect(
      call(
        appRouter.orders.updateContact,
        {
          orderId,
          name: 'Mallory',
          email: 'mallory@example.com',
          phone: '9000000000',
          address: newAddress,
          alsoUpdateCustomer: true,
        },
        { context: b.ctx },
      ),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' })

    const addr = {
      name: 'Mallory',
      line1: '1 Evil Lane',
      city: 'Delhi',
      stateCode: 'DL',
      pincode: '110001',
      phone: '9000000000',
    }
    await expect(
      call(appRouter.customers.addAddress, { customerId, address: addr }, { context: b.ctx }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' })
    await expect(
      call(
        appRouter.customers.updateAddress,
        { customerId, addressId: saved?.id as string, address: addr },
        { context: b.ctx },
      ),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' })
    await expect(
      call(
        appRouter.customers.deleteAddress,
        { customerId, addressId: saved?.id as string },
        { context: b.ctx },
      ),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' })
    await expect(
      call(
        appRouter.orders.collectPayment,
        { orderId, amountPaise: 150000, paidWith: 'cash' },
        { context: b.ctx },
      ),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' })

    // Nothing moved in store A.
    const [o] = await owner.select().from(order).where(eq(order.id, orderId))
    expect(o).toMatchObject({ email: 'asha1@example.com', shippingAddressId: addressId })
    const book = await owner.select().from(customerAddress)
    expect(book).toHaveLength(1)
    expect(book[0]).toMatchObject({ line1: '12 MG Road', storeId: a.storeId })
    expect(await owner.select().from(orderNote)).toHaveLength(0)
    expect(await owner.select().from(payment)).toHaveLength(0)
  })

  it('manages the address book for its own customer', async () => {
    const a = await merchant('a@example.com', 'store-a')
    const { customerId } = await seedOrder(a.storeId)
    const base = {
      name: 'Asha Menon',
      line1: '12 MG Road',
      city: 'Pune',
      stateCode: 'MH',
      pincode: '411001',
      phone: '9876543210',
    }
    const first = await call(
      appRouter.customers.addAddress,
      { customerId, address: base },
      { context: a.ctx },
    )
    const second = await call(
      appRouter.customers.addAddress,
      { customerId, address: { ...base, line1: '9 FC Road', isDefault: true } },
      { context: a.ctx },
    )
    await call(
      appRouter.customers.updateAddress,
      { customerId, addressId: first.id, address: { ...base, line1: '12A MG Road' } },
      { context: a.ctx },
    )
    const detail = await call(appRouter.customers.get, { id: customerId }, { context: a.ctx })
    expect(detail?.addresses.map((x) => [x.line1, x.isDefault])).toEqual([
      ['9 FC Road', true],
      ['12A MG Road', false],
    ])
    await call(
      appRouter.customers.deleteAddress,
      { customerId, addressId: second.id },
      { context: a.ctx },
    )
    const after = await call(appRouter.customers.get, { id: customerId }, { context: a.ctx })
    expect(after?.addresses).toHaveLength(1)
    expect(after?.addresses[0]).toMatchObject({ line1: '12A MG Road', isDefault: true })
    expect(after?.defaultAddress).toMatchObject({ line1: '12A MG Road' })
  })
})
