import { createMerchantAuth } from '@commerce/auth'
import {
  address,
  cart,
  createDb,
  customer,
  customerNote,
  order,
  orderNote,
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

/** A customer (no phone of their own) with one open, unpaid UPI order. */
async function seedOrder(storeId: string) {
  const [c] = await owner
    .insert(customer)
    .values({ storeId, name: 'Asha Menon', email: 'asha@example.com' })
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
      number: 7,
      customerId: c?.id,
      email: 'asha@example.com',
      phone: '09876543210',
      shippingAddressId: a?.id,
      status: 'open',
      paymentMethod: 'manual',
      subtotalPaise: 150000,
      totalPaise: 150000,
    })
    .returning()
  return { customerId: c?.id as string, orderId: o?.id as string }
}

beforeEach(async () => {
  await resetDb(owner)
  sent.length = 0
})
afterAll(async () => {
  await owner.$client.end()
  await app.$client.end()
})

describe('WhatsApp click to chat', () => {
  it('gives an unpaid order its phone, names and pay link with no WhatsApp channel', async () => {
    const a = await merchant('wa-a@example.com', 'wa-a')
    const { orderId } = await seedOrder(a.storeId)

    const chat = await call(
      appRouter.orders.whatsappChat,
      { kind: 'order', id: orderId },
      { context: a.ctx },
    )

    expect(chat).toMatchObject({
      phone: '09876543210',
      storeName: 'wa-a',
      customerName: 'Asha Menon',
      orderNumber: 7,
    })
    expect(chat.links.order).toContain('/checkout/thank-you/7?t=')
    expect(chat.links.payment).toBe(chat.links.order)
    expect(chat.links.tracking).toBeUndefined()
  })

  it('notes the opened chat on the order timeline', async () => {
    const a = await merchant('wa-b@example.com', 'wa-b')
    const { orderId } = await seedOrder(a.storeId)

    const r = await call(
      appRouter.orders.noteWhatsappChat,
      { kind: 'order', id: orderId, template: 'payment' },
      { context: a.ctx },
    )

    expect(r).toEqual({ noted: true })
    const notes = await owner.select().from(orderNote).where(eq(orderNote.orderId, orderId))
    expect(notes).toEqual([
      expect.objectContaining({
        body: 'Opened WhatsApp chat (payment link).',
        author: 'wa-b@example.com',
      }),
    ])
  })

  it("notes it on the customer's Timeline and returns it from customers.get", async () => {
    const a = await merchant('wa-c@example.com', 'wa-c')
    const { customerId } = await seedOrder(a.storeId)

    const chat = await call(
      appRouter.customers.whatsappChat,
      { id: customerId },
      { context: a.ctx },
    )
    // No phone of their own: their latest order's, with its links.
    expect(chat.phone).toBe('09876543210')
    expect(chat.orderNumber).toBe(7)

    await call(
      appRouter.customers.noteWhatsappChat,
      { id: customerId, template: 'order_confirmation' },
      { context: a.ctx },
    )
    const rows = await owner
      .select()
      .from(customerNote)
      .where(eq(customerNote.customerId, customerId))
    expect(rows.map((n) => n.body)).toEqual(['Opened WhatsApp chat (order confirmation).'])
    const detail = await call(appRouter.customers.get, { id: customerId }, { context: a.ctx })
    expect(detail?.notes.map((n) => n.body)).toEqual(['Opened WhatsApp chat (order confirmation).'])
  })

  it("gives a checkout its recovery link and never reaches another store's order", async () => {
    const a = await merchant('wa-d@example.com', 'wa-d')
    const b = await merchant('wa-e@example.com', 'wa-e')
    const [c] = await owner
      .insert(cart)
      .values({ storeId: a.storeId, phone: '98765 43210', customerName: 'Riya' })
      .returning()

    const chat = await call(
      appRouter.orders.whatsappChat,
      { kind: 'checkout', id: c?.id as string },
      { context: a.ctx },
    )
    expect(chat.links.recovery).toContain('/checkout/recover/')
    // A guest checkout has no timeline to note on.
    const guest = await call(
      appRouter.orders.noteWhatsappChat,
      { kind: 'checkout', id: c?.id as string, template: 'cart_recovery' },
      { context: a.ctx },
    )
    expect(guest).toEqual({ noted: false })

    const { orderId } = await seedOrder(a.storeId)
    await expect(
      call(appRouter.orders.whatsappChat, { kind: 'order', id: orderId }, { context: b.ctx }),
    ).rejects.toThrow()
    const other = await call(
      appRouter.orders.noteWhatsappChat,
      { kind: 'order', id: orderId, template: 'blank' },
      { context: b.ctx },
    )
    expect(other).toEqual({ noted: false })
  })
})
