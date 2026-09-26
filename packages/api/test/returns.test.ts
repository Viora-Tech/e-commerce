import { createMerchantAuth } from '@commerce/auth'
import {
  address,
  createDb,
  order,
  orderLine,
  payment,
  product,
  role,
  store,
  storeMember,
  variant,
} from '@commerce/db'
import { resetDb } from '@commerce/db/test'
import { call } from '@orpc/server'
import { and, eq } from 'drizzle-orm'
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

const ctx = (headers: Headers) =>
  ({ db: app, auth, headers, notifications: { add: async () => undefined } }) as ApiContext

async function merchant(email: string, slug: string) {
  const headers = await signIn(email)
  const org = await auth.api.createOrganization({ headers, body: { name: slug, slug } })
  await auth.api.setActiveOrganization({ headers, body: { organizationId: org?.id as string } })
  const [s] = await owner
    .insert(store)
    .values({ slug, name: slug, organizationId: org?.id as string })
    .returning()
  return { ctx: ctx(headers), headers, storeId: s?.id as string, orgId: org?.id as string }
}

/** A delivered, paid (manual UPI) order of two pads. */
async function seedOrder(storeId: string) {
  const [a] = await owner
    .insert(address)
    .values({
      storeId,
      name: 'Asha',
      line1: '12 MG Road',
      city: 'Bengaluru',
      stateCode: 'KA',
      pincode: '560001',
      phone: '9999999999',
    })
    .returning()
  const [p] = await owner
    .insert(product)
    .values({ storeId, handle: 'pad', title: 'Pad', status: 'active' })
    .returning()
  const [v] = await owner
    .insert(variant)
    .values({ storeId, productId: p?.id as string, title: 'Large', pricePaise: 100_000 })
    .returning()
  const [o] = await owner
    .insert(order)
    .values({
      storeId,
      number: 1,
      status: 'open',
      paymentMethod: 'manual',
      subtotalPaise: 200_000,
      totalPaise: 200_000,
      email: 'asha@example.com',
      shippingAddressId: a?.id,
      deliveredAt: new Date(),
    })
    .returning()
  const [line] = await owner
    .insert(orderLine)
    .values({
      storeId,
      orderId: o?.id as string,
      variantId: v?.id as string,
      title: 'Pad',
      variantTitle: 'Large',
      quantity: 2,
      fulfilledQuantity: 2,
      unitPricePaise: 100_000,
    })
    .returning()
  await owner.insert(payment).values({
    storeId,
    orderId: o?.id as string,
    provider: 'manual',
    providerRef: 'ref_1',
    status: 'captured',
    amountPaise: 200_000,
  })
  return { orderId: o?.id as string, lineId: line?.id as string }
}

beforeEach(async () => {
  await resetDb(owner)
  sent.length = 0
})
afterAll(async () => {
  await owner.$client.end()
  await app.$client.end()
})

describe('returns router', () => {
  it('opens, approves, receives and refunds a return; lists and counts it', async () => {
    const m = await merchant('a@example.com', 'returns-a')
    const { orderId, lineId } = await seedOrder(m.storeId)

    const created = await call(
      appRouter.returns.create,
      { orderId, lines: [{ orderLineId: lineId, quantity: 1 }], reason: 'damaged' },
      { context: m.ctx },
    )
    expect(created.status).toBe('requested')

    const list = await call(appRouter.returns.list, {}, { context: m.ctx })
    expect(list.total).toBe(1)
    expect(list.items[0]).toMatchObject({ label: 'R-1', orderNumber: 1, items: 1 })
    expect(await call(appRouter.returns.counts, undefined, { context: m.ctx })).toMatchObject({
      all: 1,
      requested: 1,
    })

    const approved = await call(
      appRouter.returns.approve,
      { id: created.id, pickup: { method: 'customer' } },
      { context: m.ctx },
    )
    expect(approved).toMatchObject({ status: 'in_transit', pickupMethod: 'customer' })

    await call(appRouter.returns.receive, { id: created.id, condition: 'good' }, { context: m.ctx })
    const detail = await call(appRouter.returns.get, { id: created.id }, { context: m.ctx })
    expect(detail).toMatchObject({ status: 'received', suggestedRefundPaise: 100_000 })
    expect(detail?.refundablePaise).toBe(200_000)

    const refunded = await call(
      appRouter.returns.refund,
      { id: created.id, amountPaise: 100_000 },
      { context: m.ctx },
    )
    expect(refunded).toMatchObject({ status: 'resolved', resolution: 'refund' })
    const [o] = await owner.select().from(order).where(eq(order.id, orderId))
    expect(o?.paymentStatus).toBe('partially_refunded')

    await expect(
      call(appRouter.returns.refund, { id: created.id, amountPaise: 1 }, { context: m.ctx }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' })
  })

  it('refuses returns.refund to a role without orders.refund', async () => {
    const boss = await merchant('boss@example.com', 'returns-b')
    await call(appRouter.staff.me, {}, { context: boss.ctx })
    const { orderId, lineId } = await seedOrder(boss.storeId)
    const r = await call(
      appRouter.returns.create,
      { orderId, lines: [{ orderLineId: lineId, quantity: 1 }], reason: 'damaged' },
      { context: boss.ctx },
    )

    const helperHeaders = await signIn('helper@example.com')
    const helperId = (await auth.api.getSession({ headers: helperHeaders }))?.user.id as string
    await auth.api.addMember({
      body: { userId: helperId, role: 'member', organizationId: boss.orgId },
    })
    await auth.api.setActiveOrganization({
      headers: helperHeaders,
      body: { organizationId: boss.orgId },
    })
    const [staff] = await owner
      .select()
      .from(role)
      .where(and(eq(role.storeId, boss.storeId), eq(role.slug, 'staff')))
    const existing = await owner
      .select()
      .from(storeMember)
      .where(and(eq(storeMember.storeId, boss.storeId), eq(storeMember.userId, helperId)))
    if (existing[0]) {
      await owner
        .update(storeMember)
        .set({ roleId: staff?.id as string })
        .where(eq(storeMember.id, existing[0].id))
    } else {
      await owner
        .insert(storeMember)
        .values({ storeId: boss.storeId, userId: helperId, roleId: staff?.id as string })
    }

    const helper = ctx(helperHeaders)
    // Staff can read and work the return...
    expect((await call(appRouter.returns.list, {}, { context: helper })).total).toBe(1)
    // ...but cannot move money.
    await expect(
      call(appRouter.returns.refund, { id: r.id, amountPaise: 100 }, { context: helper }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' })
  })

  it('saves and reads the returns policy', async () => {
    const m = await merchant('c@example.com', 'returns-c')
    const before = await call(appRouter.returns.policy, undefined, { context: m.ctx })
    expect(before).toMatchObject({ enabled: true, windowDays: 7, refundMethod: 'original' })
    await call(
      appRouter.returns.savePolicy,
      {
        enabled: true,
        windowDays: 14,
        reasons: ['wrong_item', 'damaged'],
        restockAutomatically: false,
        refundMethod: 'store_credit',
      },
      { context: m.ctx },
    )
    const after = await call(appRouter.returns.policy, undefined, { context: m.ctx })
    expect(after).toEqual({
      enabled: true,
      windowDays: 14,
      reasons: ['damaged', 'wrong_item'],
      restockAutomatically: false,
      refundMethod: 'store_credit',
    })
  })
})
