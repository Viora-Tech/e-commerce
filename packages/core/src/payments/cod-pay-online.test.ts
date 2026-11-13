/** SOURCE OF TRUTH: "Ask to pay online" on cash on delivery — WHAT: the request and its guards, the switch to the gateway, the capture that makes the order prepaid, the one reminder; HOW: real orders against the test database. */
import {
  cart,
  cartLine,
  createDb,
  inventoryLevel,
  order,
  orderNote,
  outboxEvent,
  payment,
  product,
  store,
  variant,
  withStore,
} from '@commerce/db'
import { resetDb } from '@commerce/db/test'
import { and, eq } from 'drizzle-orm'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { placeOrderAndPay } from '../order/place-order'
import { changeOrderStatus } from '../order/status'
import { CodPaymentProvider } from '../providers/cod'
import { requestOnlinePayment, runPayOnlineReminders } from './cod-pay-online'
import { applyPaymentStatus } from './confirm'
import { expiredUnpaidOrders } from './expiry'
import { GatewayDouble } from './gateway-double.test-util'
import { payOnlineInstead } from './pay-online-instead'

const owner = createDb(process.env.DATABASE_URL_OWNER as string)
const app = createDb(process.env.DATABASE_URL as string)
const DAY = 86_400_000
const COD_PAID_ONLINE_NOTE =
  'Paid online, so this order now ships prepaid instead of cash on delivery.'
const PAY_ONLINE_REQUESTED_NOTE =
  'Asked the customer to pay online instead of cash on delivery. Payment link sent.'
const PAY_ONLINE_REMINDED_NOTE =
  'Automatic reminder sent to the customer to pay online instead of cash on delivery.'

beforeEach(async () => {
  await resetDb(owner)
})
afterAll(async () => {
  await owner.$client.end()
  await app.$client.end()
})

/** A placed ₹100 cash on delivery order in a store that also takes `gw` online. */
async function codOrder(slug = 'w') {
  const [s] = await owner
    .insert(store)
    .values({ slug, name: slug, payments: { enabled: ['cod', 'gw'] } })
    .returning()
  if (!s) throw new Error('seed')
  const [p] = await owner
    .insert(product)
    .values({ storeId: s.id, handle: 'mouse', title: 'Mouse', status: 'active' })
    .returning()
  if (!p) throw new Error('seed')
  const [v] = await owner
    .insert(variant)
    .values({ storeId: s.id, productId: p.id, title: 'Black', pricePaise: 10000 })
    .returning()
  if (!v) throw new Error('seed')
  await owner.insert(inventoryLevel).values({ storeId: s.id, variantId: v.id, onHand: 5 })
  const [c] = await owner.insert(cart).values({ storeId: s.id }).returning()
  if (!c) throw new Error('seed')
  await owner.insert(cartLine).values({
    storeId: s.id,
    cartId: c.id,
    variantId: v.id,
    quantity: 1,
    unitPricePaise: 10000,
  })
  const placed = await placeOrderAndPay(app, s.id, {
    cartId: c.id,
    paymentProvider: new CodPaymentProvider(),
  })
  await owner
    .update(order)
    .set({ email: 'riya@example.com', phone: '9820012345' })
    .where(eq(order.id, placed.orderId))
  return { storeId: s.id, orderId: placed.orderId }
}

const orderRow = async (orderId: string) =>
  (await owner.select().from(order).where(eq(order.id, orderId)))[0]
const payments = (orderId: string) =>
  owner.select().from(payment).where(eq(payment.orderId, orderId))
const notes = async (orderId: string) =>
  (await owner.select().from(orderNote).where(eq(orderNote.orderId, orderId))).map((n) => n.body)
const requests = (orderId: string) =>
  owner
    .select()
    .from(outboxEvent)
    .where(
      and(eq(outboxEvent.type, 'order.pay_online_requested'), eq(outboxEvent.payload, { orderId })),
    )

const request = (storeId: string, orderId: string, now?: Date) =>
  withStore(app, storeId, (tx) =>
    requestOnlinePayment({ storeId, tx }, orderId, { author: 'staff@waimers.in', now }),
  )

describe('payOnlineInstead on cash on delivery', () => {
  it('cancels the open COD attempt and asks the gateway for the whole total', async () => {
    const { storeId, orderId } = await codOrder()
    expect((await orderRow(orderId))?.paymentMethod).toBe('cod')
    const gateway = new GatewayDouble()
    await payOnlineInstead(app, storeId, orderId, gateway)

    const pays = await payments(orderId)
    expect(pays.find((p) => p.provider === 'cod')?.status).toBe('cancelled')
    const online = pays.find((p) => p.provider === gateway.id)
    expect(online?.amountPaise).toBe(10000)
    expect(online?.status).toBe('pending')
    // Still COD until the money arrives: the unpaid expiry never sees it.
    const o = await orderRow(orderId)
    expect(o?.paymentMethod).toBe('cod')
    expect(o?.totalPaise).toBe(10000)
    expect(await notes(orderId)).toContain(
      'The customer chose to pay online with Gateway double instead of cash on delivery.',
    )
    const expiring = await withStore(app, storeId, (tx) =>
      expiredUnpaidOrders({ storeId, tx }, new Date(Date.now() + 30 * DAY)),
    )
    expect(expiring.orderIds).not.toContain(orderId)
  })

  it('opens one gateway attempt when the shopper taps twice', async () => {
    const { storeId, orderId } = await codOrder()
    const gateway = new GatewayDouble()
    await payOnlineInstead(app, storeId, orderId, gateway)
    await payOnlineInstead(app, storeId, orderId, gateway)
    const pays = await payments(orderId)
    expect(pays.filter((p) => p.provider === gateway.id)).toHaveLength(1)
  })

  it('works with no COD attempt left, for what is still due', async () => {
    const { storeId, orderId } = await codOrder()
    await owner.delete(payment).where(eq(payment.orderId, orderId))
    await owner.insert(payment).values({
      storeId,
      orderId,
      provider: 'manual',
      providerRef: 'cash_part',
      status: 'captured',
      amountPaise: 3000,
    })
    const gateway = new GatewayDouble()
    await payOnlineInstead(app, storeId, orderId, gateway)
    const pays = await payments(orderId)
    expect(pays.find((p) => p.provider === gateway.id)?.amountPaise).toBe(7000)
  })

  it('refuses a COD order already packed', async () => {
    const { storeId, orderId } = await codOrder()
    await owner.update(order).set({ fulfillmentStatus: 'fulfilled' }).where(eq(order.id, orderId))
    await expect(payOnlineInstead(app, storeId, orderId, new GatewayDouble())).rejects.toThrow(
      /packed/,
    )
    expect((await payments(orderId)).every((p) => p.provider === 'cod')).toBe(true)
  })

  it('refuses a cancelled COD order', async () => {
    const { storeId, orderId } = await codOrder()
    await owner.update(order).set({ status: 'cancelled' }).where(eq(order.id, orderId))
    await expect(payOnlineInstead(app, storeId, orderId, new GatewayDouble())).rejects.toThrow()
  })
})

describe('a COD order paid online', () => {
  it('ships prepaid once the gateway capture covers it', async () => {
    const { storeId, orderId } = await codOrder()
    await owner
      .update(order)
      .set({ codVerification: 'unconfirmed', tags: ['cod-unconfirmed', 'vip'] })
      .where(eq(order.id, orderId))
    const gateway = new GatewayDouble()
    const started = await payOnlineInstead(app, storeId, orderId, gateway)
    await withStore(app, storeId, (tx) =>
      applyPaymentStatus(
        { storeId, tx },
        { paymentId: started.attemptId, status: 'captured', providerPaymentId: 'pay_1' },
      ),
    )
    const o = await orderRow(orderId)
    expect(o?.checkoutPaidAt).not.toBeNull()
    expect(o?.paymentStatus).toBe('paid')
    expect(o?.paymentMethod).toBe(gateway.id)
    expect(o?.codVerification).toBe('confirmed')
    expect(o?.tags).toEqual(['vip'])
    expect(await notes(orderId)).toContain(COD_PAID_ONLINE_NOTE)
  })

  it('stays COD when staff mark the cash collected, leaving the gateway attempt alone', async () => {
    const { storeId, orderId } = await codOrder()
    const gateway = new GatewayDouble()
    await payOnlineInstead(app, storeId, orderId, gateway)
    await withStore(app, storeId, (tx) => changeOrderStatus({ storeId, tx }, orderId, 'paid'))
    const o = await orderRow(orderId)
    expect(o?.paymentStatus).toBe('paid')
    expect(o?.paymentMethod).toBe('cod')
    const pays = await payments(orderId)
    expect(pays.find((p) => p.provider === gateway.id)?.status).toBe('pending')
    expect(pays.find((p) => p.provider === 'cod' && p.status === 'captured')?.amountPaise).toBe(
      10000,
    )
    expect(await notes(orderId)).not.toContain(COD_PAID_ONLINE_NOTE)
  })
})

describe('requestOnlinePayment', () => {
  it('records the request, notes it and queues the message', async () => {
    const { storeId, orderId } = await codOrder()
    const now = new Date('2026-11-13T10:00:00Z')
    const r = await request(storeId, orderId, now)
    expect(r.requestedAt).toEqual(now)
    const o = await orderRow(orderId)
    expect(o?.payOnlineRequestedAt).toEqual(now)
    expect(o?.paymentMethod).toBe('cod')
    expect(await notes(orderId)).toContain(PAY_ONLINE_REQUESTED_NOTE)
    expect(await requests(orderId)).toHaveLength(1)
  })

  it('refuses paid, cancelled, draft, imported and non-COD orders', async () => {
    const { storeId, orderId } = await codOrder()
    const refused = async (set: Partial<typeof order.$inferInsert>, message: RegExp) => {
      const [before] = await owner.select().from(order).where(eq(order.id, orderId))
      await owner.update(order).set(set).where(eq(order.id, orderId))
      await expect(request(storeId, orderId)).rejects.toThrow(message)
      if (before) {
        await owner
          .update(order)
          .set({
            status: before.status,
            checkoutPaidAt: before.checkoutPaidAt,
            paymentStatus: before.paymentStatus,
            paymentMethod: before.paymentMethod,
            importedFrom: before.importedFrom,
            fulfillmentStatus: before.fulfillmentStatus,
          })
          .where(eq(order.id, orderId))
      }
    }
    await refused({ checkoutPaidAt: new Date(), paymentStatus: 'paid' }, /already paid/)
    await refused({ status: 'cancelled' }, /cancelled/)
    await refused({ status: 'draft' }, /draft/)
    await refused({ importedFrom: 'shopify' }, /Imported/)
    await refused({ paymentMethod: 'gw' }, /cash on delivery/)
    await refused({ fulfillmentStatus: 'fulfilled' }, /packed/)
    expect(await requests(orderId)).toHaveLength(0)
    expect((await orderRow(orderId))?.payOnlineRequestedAt).toBeNull()
  })

  it('refuses a store with no online payment method', async () => {
    const { storeId, orderId } = await codOrder()
    await owner
      .update(store)
      .set({ payments: { enabled: ['cod', 'manual'] } })
      .where(eq(store.id, storeId))
    await expect(request(storeId, orderId)).rejects.toThrow(/online payment/)
  })

  it("cannot reach another store's order", async () => {
    const { orderId } = await codOrder('w')
    const other = await codOrder('x')
    await expect(request(other.storeId, orderId)).rejects.toThrow(/not found/)
    expect((await orderRow(orderId))?.payOnlineRequestedAt).toBeNull()
  })
})

describe('runPayOnlineReminders', () => {
  it('reminds once, two days after the request, and never cancels', async () => {
    const { storeId, orderId } = await codOrder()
    const asked = new Date('2026-11-13T10:00:00Z')
    await request(storeId, orderId, asked)

    expect(await runPayOnlineReminders(app, storeId, new Date(asked.getTime() + DAY))).toBe(0)
    const later = new Date(asked.getTime() + 2 * DAY + 60_000)
    expect(await runPayOnlineReminders(app, storeId, later)).toBe(1)
    expect(await runPayOnlineReminders(app, storeId, new Date(later.getTime() + 5 * DAY))).toBe(0)

    const o = await orderRow(orderId)
    expect(o?.payOnlineRemindedAt).toEqual(later)
    expect(o?.status).toBe('open')
    expect(o?.paymentMethod).toBe('cod')
    expect(await requests(orderId)).toHaveLength(2)
    expect(await notes(orderId)).toContain(PAY_ONLINE_REMINDED_NOTE)
  })

  it('skips an order paid meanwhile', async () => {
    const { storeId, orderId } = await codOrder()
    const asked = new Date('2026-11-13T10:00:00Z')
    await request(storeId, orderId, asked)
    await owner.update(order).set({ checkoutPaidAt: new Date() }).where(eq(order.id, orderId))
    expect(await runPayOnlineReminders(app, storeId, new Date(asked.getTime() + 3 * DAY))).toBe(0)
    expect((await orderRow(orderId))?.payOnlineRemindedAt).toBeNull()
  })
})
