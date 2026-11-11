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
  shipment,
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
import { cancelShipment } from '../shipping/shipment-cancel'
import { applyTracking, createShipmentForOrder } from '../shipping/shipments'
import { fulfilOrderLines } from './fulfil'
import { placeOrderAndPay } from './place-order'
import { recomputeOrderStatuses } from './recompute'
import { refundPayment } from './refund'
import { restoreCancelledOrder } from './restore-order'
import { cancelOrder, changeOrderStatus } from './status'
import { undoDelivered } from './undo-delivered'
import { undoPacked } from './undo-packed'

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

  it('a cancelled label puts the order back in To ship; a collected parcel cannot be cancelled', async () => {
    const { storeId, orderId } = await placeCod()
    const provider = new FakeShippingProvider()
    const ship = await inStore(storeId, (ctx) => createShipmentForOrder(ctx, provider, orderId))
    await inStore(storeId, (ctx) => cancelShipment(ctx, provider, ship.id))
    expect(await statuses(orderId)).toEqual(['open', 'unpaid', 'unfulfilled'])

    const again = await inStore(storeId, (ctx) => createShipmentForOrder(ctx, provider, orderId))
    await inStore(storeId, (ctx) =>
      applyTracking(ctx, again.id, { waybill: again.waybill, status: 'picked_up', events: [] }),
    )
    expect(await statuses(orderId)).toEqual(['open', 'unpaid', 'shipped'])
    await expect(
      inStore(storeId, (ctx) => cancelShipment(ctx, provider, again.id)),
    ).rejects.toMatchObject({ block: 'picked_up' })
    expect(await statuses(orderId)).toEqual(['open', 'unpaid', 'shipped'])
  })

  it('marked delivered by mistake after a cancelled booking: undo puts it back in To ship', async () => {
    const { storeId, orderId } = await placeCod()
    const provider = new FakeShippingProvider()
    const ship = await inStore(storeId, (ctx) => createShipmentForOrder(ctx, provider, orderId))
    await inStore(storeId, (ctx) => cancelShipment(ctx, provider, ship.id))
    await inStore(storeId, (ctx) => changeOrderStatus(ctx, orderId, 'delivered'))
    expect(await statuses(orderId)).toEqual(['open', 'unpaid', 'delivered'])
    expect(await inStore(storeId, (ctx) => undoDelivered(ctx, orderId))).toBe(true)
    expect(await statuses(orderId)).toEqual(['open', 'unpaid', 'unfulfilled'])
    // Nothing left to undo.
    expect(await inStore(storeId, (ctx) => undoDelivered(ctx, orderId))).toBe(false)
  })

  it('undo leaves a parcel the courier itself reported delivered alone', async () => {
    const { storeId, orderId } = await placeCod()
    const provider = new FakeShippingProvider()
    const ship = await inStore(storeId, (ctx) => createShipmentForOrder(ctx, provider, orderId))
    await inStore(storeId, (ctx) =>
      applyTracking(ctx, ship.id, { waybill: ship.waybill, status: 'delivered', events: [] }),
    )
    await inStore(storeId, (ctx) => changeOrderStatus(ctx, orderId, 'delivered'))
    await inStore(storeId, (ctx) => undoDelivered(ctx, orderId))
    expect((await statuses(orderId))[2]).toBe('delivered')
  })

  it('Mark as not shipped: a label cancelled before the unpack fix goes back to To ship (#2424)', async () => {
    const { storeId, orderId } = await placeCod()
    const provider = new FakeShippingProvider()
    const ship = await inStore(storeId, (ctx) => createShipmentForOrder(ctx, provider, orderId))
    // A live booking with a bought label: cancel it with the courier first.
    await owner
      .update(shipment)
      .set({ labelUrl: 'https://labels.test/1.pdf' })
      .where(eq(shipment.id, ship.id))
    expect(await inStore(storeId, (ctx) => undoPacked(ctx, orderId))).toEqual({
      undone: false,
      reason: 'live_shipment',
    })
    // The old cancel only marked the label cancelled and left its items packed.
    await owner.update(shipment).set({ status: 'cancelled' }).where(eq(shipment.id, ship.id))
    expect((await statuses(orderId))[2]).not.toBe('unfulfilled')
    expect(await inStore(storeId, (ctx) => undoPacked(ctx, orderId))).toEqual({
      undone: true,
      units: 2,
    })
    expect(await statuses(orderId)).toEqual(['open', 'unpaid', 'unfulfilled'])
    expect(await inStore(storeId, (ctx) => undoPacked(ctx, orderId))).toEqual({
      undone: false,
      reason: 'not_packed',
    })
  })

  it('Mark as unfulfilled closes a tracking number typed by hand (no label)', async () => {
    const { storeId, orderId } = await placeCod()
    const ship = await inStore(storeId, (ctx) =>
      createShipmentForOrder(ctx, new FakeShippingProvider(), orderId),
    )
    expect(await inStore(storeId, (ctx) => undoPacked(ctx, orderId))).toEqual({
      undone: true,
      units: 2,
    })
    const [row] = await owner.select().from(shipment).where(eq(shipment.id, ship.id))
    expect(row?.status).toBe('cancelled')
    expect((await statuses(orderId))[2]).toBe('unfulfilled')
  })

  it('Restore order: a cancelled order opens again and holds its stock again', async () => {
    const { storeId, orderId } = await placeCod()
    const held = async () =>
      (await owner.select({ reserved: inventoryLevel.reserved }).from(inventoryLevel))[0]?.reserved
    expect(await held()).toBe(2)
    await inStore(storeId, (ctx) => cancelOrder(ctx, orderId, { notifyCustomer: false }))
    expect(await held()).toBe(0)
    expect(await inStore(storeId, (ctx) => restoreCancelledOrder(ctx, orderId))).toEqual({
      restored: true,
      units: 2,
    })
    expect(await held()).toBe(2)
    expect(await statuses(orderId)).toEqual(['open', 'unpaid', 'unfulfilled'])
    // Packing works again after a restore.
    await inStore(storeId, (ctx) => changeOrderStatus(ctx, orderId, 'fulfilled'))
    expect((await statuses(orderId))[2]).toBe('fulfilled')
    expect(await inStore(storeId, (ctx) => restoreCancelledOrder(ctx, orderId))).toEqual({
      restored: false,
      reason: 'not_cancelled',
    })
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
