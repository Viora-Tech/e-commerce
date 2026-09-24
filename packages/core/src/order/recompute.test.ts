import {
  address,
  cart,
  cartLine,
  createDb,
  inventoryLevel,
  order,
  orderLine,
  outboxEvent,
  payment,
  product,
  store,
  variant,
  withStore,
} from '@commerce/db'
import { resetDb } from '@commerce/db/test'
import { FakeShippingProvider } from '@commerce/shipping'
import { and, eq } from 'drizzle-orm'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import type { StoreContext } from '../context'
import { applyPaymentStatus } from '../payments/confirm'
import { CodPaymentProvider } from '../providers/cod'
import { FakePaymentProvider } from '../providers/payment'
import { applyTracking, cancelShipment, createShipmentForOrder } from '../shipping/shipments'
import { fulfilOrderLines } from './fulfil'
import { placeOrderAndPay } from './place-order'
import { recomputeOrderStatuses } from './recompute'
import { refundPayment } from './refund'
import { cancelOrder, changeOrderStatus } from './status'

const owner = createDb(process.env.DATABASE_URL_OWNER as string)
const app = createDb(process.env.DATABASE_URL as string)

beforeEach(async () => {
  await resetDb(owner)
})
afterAll(async () => {
  await owner.$client.end()
  await app.$client.end()
})

/** A store with one tracked product and a cart for 2 of it, ready to check out. */
async function seedCart(slug = 'w') {
  const [s] = await owner.insert(store).values({ slug, name: slug }).returning()
  if (!s) throw new Error('seed')
  const [p] = await owner
    .insert(product)
    .values({ storeId: s.id, handle: 'mouse', title: 'Mouse', status: 'active' })
    .returning()
  const [v] = await owner
    .insert(variant)
    .values({ storeId: s.id, productId: p?.id as string, title: 'Black', pricePaise: 10000 })
    .returning()
  if (!v) throw new Error('seed')
  await owner.insert(inventoryLevel).values({ storeId: s.id, variantId: v.id, onHand: 5 })
  const [c] = await owner.insert(cart).values({ storeId: s.id }).returning()
  if (!c) throw new Error('seed')
  await owner.insert(cartLine).values({
    storeId: s.id,
    cartId: c.id,
    variantId: v.id,
    quantity: 2,
    unitPricePaise: 10000,
  })
  return { storeId: s.id, cartId: c.id }
}

async function placeCod(slug?: string) {
  const { storeId, cartId } = await seedCart(slug)
  const r = await placeOrderAndPay(app, storeId, {
    cartId,
    paymentProvider: new CodPaymentProvider(),
  })
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
  await owner.update(order).set({ shippingAddressId: a?.id }).where(eq(order.id, r.orderId))
  return { storeId, orderId: r.orderId }
}

const inStore = <T>(storeId: string, fn: (ctx: StoreContext) => Promise<T>) =>
  withStore(app, storeId, (tx) => fn({ storeId, tx }))

const statuses = async (orderId: string) => {
  const [o] = await owner.select().from(order).where(eq(order.id, orderId))
  return [o?.status, o?.paymentStatus, o?.fulfillmentStatus]
}

const events = async (orderId: string, type: string) =>
  (await owner.select().from(outboxEvent).where(eq(outboxEvent.type, type))).filter(
    (e) => (e.payload as { orderId?: string }).orderId === orderId,
  ).length

describe('recomputeOrderStatuses on every mutation path', () => {
  it('walks a COD order from placed to completed, announcing each step once', async () => {
    const { storeId, orderId } = await placeCod()
    expect(await statuses(orderId)).toEqual(['open', 'unpaid', 'unfulfilled'])
    expect(await events(orderId, 'order.paid')).toBe(0)

    const lines = await owner.select().from(orderLine).where(eq(orderLine.orderId, orderId))
    const line = lines[0]
    if (!line) throw new Error('no line')
    await inStore(storeId, (ctx) =>
      fulfilOrderLines(ctx, { orderId, lines: [{ lineId: line.id, quantity: 1 }] }),
    )
    expect(await statuses(orderId)).toEqual(['open', 'unpaid', 'partially_fulfilled'])
    expect(await events(orderId, 'order.fulfilled')).toBe(0)

    // Booking the courier packs the rest: fulfilled, announced once.
    const provider = new FakeShippingProvider()
    const ship = await inStore(storeId, (ctx) => createShipmentForOrder(ctx, provider, orderId))
    expect(await statuses(orderId)).toEqual(['open', 'unpaid', 'fulfilled'])
    expect(await events(orderId, 'order.fulfilled')).toBe(1)

    await inStore(storeId, (ctx) =>
      applyTracking(ctx, ship.id, { waybill: ship.waybill, status: 'in_transit', events: [] }),
    )
    expect(await statuses(orderId)).toEqual(['open', 'unpaid', 'shipped'])
    await inStore(storeId, (ctx) =>
      applyTracking(ctx, ship.id, { waybill: ship.waybill, status: 'delivered', events: [] }),
    )
    // Delivered, but the cash is not in yet.
    expect(await statuses(orderId)).toEqual(['open', 'unpaid', 'delivered'])

    await inStore(storeId, (ctx) => changeOrderStatus(ctx, orderId, 'paid'))
    expect(await statuses(orderId)).toEqual(['completed', 'paid', 'delivered'])
    expect(await events(orderId, 'order.paid')).toBe(1)

    // Marking paid again changes nothing and announces nothing.
    await inStore(storeId, (ctx) => changeOrderStatus(ctx, orderId, 'paid'))
    expect(await events(orderId, 'order.paid')).toBe(1)
    expect(await events(orderId, 'order.fulfilled')).toBe(1)
  })

  it('a gateway capture pays the order once, however many times it is reported', async () => {
    const { storeId, cartId } = await seedCart()
    const r = await placeOrderAndPay(app, storeId, {
      cartId,
      paymentProvider: new FakePaymentProvider(),
    })
    expect(await statuses(r.orderId)).toEqual(['open', 'paid', 'unfulfilled'])
    const [p] = await owner.select().from(payment).where(eq(payment.orderId, r.orderId))
    await inStore(storeId, (ctx) =>
      applyPaymentStatus(ctx, {
        paymentId: p?.id as string,
        status: 'captured',
        providerPaymentId: null,
      }),
    )
    expect(await events(r.orderId, 'order.paid')).toBe(1)
    const [o] = await owner.select().from(order).where(eq(order.id, r.orderId))
    expect(o?.checkoutPaidAt).not.toBeNull()
  })

  it('refunds move the payment status, and a full refund still leaves a delivered order completed', async () => {
    const { storeId, cartId } = await seedCart()
    const r = await placeOrderAndPay(app, storeId, {
      cartId,
      paymentProvider: new FakePaymentProvider(),
    })
    await inStore(storeId, (ctx) => changeOrderStatus(ctx, r.orderId, 'delivered'))
    expect(await statuses(r.orderId)).toEqual(['completed', 'paid', 'delivered'])
    const [o] = await owner.select().from(order).where(eq(order.id, r.orderId))
    expect(o?.deliveredAt).not.toBeNull()

    const [p] = await owner.select().from(payment).where(eq(payment.orderId, r.orderId))
    const gw = new FakePaymentProvider()
    await inStore(storeId, (ctx) =>
      refundPayment(ctx, gw, { paymentId: p?.id as string, amountPaise: 5000 }),
    )
    expect(await statuses(r.orderId)).toEqual(['completed', 'partially_refunded', 'delivered'])
    await inStore(storeId, (ctx) =>
      refundPayment(ctx, gw, { paymentId: p?.id as string, amountPaise: 15000 }),
    )
    expect(await statuses(r.orderId)).toEqual(['completed', 'refunded', 'delivered'])
  })

  it('cancel keeps the derived statuses honest, and a late capture reads refund needed', async () => {
    const { storeId, orderId } = await placeCod()
    await inStore(storeId, (ctx) => cancelOrder(ctx, orderId))
    expect(await statuses(orderId)).toEqual(['cancelled', 'unpaid', 'unfulfilled'])
    const [p] = await owner.select().from(payment).where(eq(payment.orderId, orderId))
    await inStore(storeId, (ctx) =>
      applyPaymentStatus(ctx, {
        paymentId: p?.id as string,
        status: 'captured',
        providerPaymentId: null,
      }),
    )
    expect(await statuses(orderId)).toEqual(['cancelled', 'refund_needed', 'unfulfilled'])
    expect(await events(orderId, 'order.paid')).toBe(0)
  })

  it('a cancelled label drops the order back to packed; RTO reads returned', async () => {
    const { storeId, orderId } = await placeCod()
    const provider = new FakeShippingProvider()
    const ship = await inStore(storeId, (ctx) => createShipmentForOrder(ctx, provider, orderId))
    await inStore(storeId, (ctx) =>
      applyTracking(ctx, ship.id, { waybill: ship.waybill, status: 'picked_up', events: [] }),
    )
    expect(await statuses(orderId)).toEqual(['open', 'unpaid', 'shipped'])
    await inStore(storeId, (ctx) => cancelShipment(ctx, provider, ship.id))
    expect(await statuses(orderId)).toEqual(['open', 'unpaid', 'fulfilled'])
  })

  it('fixes a drifted row: status columns that disagree with the facts are rewritten', async () => {
    const { storeId, orderId } = await placeCod()
    await owner
      .update(order)
      .set({ status: 'completed', paymentStatus: 'paid', fulfillmentStatus: 'delivered' })
      .where(eq(order.id, orderId))
    const r = await inStore(storeId, (ctx) => recomputeOrderStatuses(ctx, orderId))
    expect(r?.changed).toBe(true)
    expect(r?.after).toEqual({
      status: 'open',
      paymentStatus: 'unpaid',
      fulfillmentStatus: 'unfulfilled',
    })
    const again = await inStore(storeId, (ctx) => recomputeOrderStatuses(ctx, orderId))
    expect(again?.changed).toBe(false)
  })

  it('never reaches another store: the recompute sees nothing there', async () => {
    const a = await placeCod('a')
    const b = await seedCart('b')
    expect(await inStore(b.storeId, (ctx) => recomputeOrderStatuses(ctx, a.orderId))).toBeNull()
    expect(await inStore(b.storeId, (ctx) => changeOrderStatus(ctx, a.orderId, 'paid'))).toBeNull()
    expect(await statuses(a.orderId)).toEqual(['open', 'unpaid', 'unfulfilled'])
    const rows = await owner
      .select()
      .from(payment)
      .where(and(eq(payment.orderId, a.orderId), eq(payment.status, 'captured')))
    expect(rows).toEqual([])
  })
})
