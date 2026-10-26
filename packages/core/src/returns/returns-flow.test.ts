/** SOURCE OF TRUTH: returns flow gaps — a courier booked after the approval email, an RTO of one parcel out of two, a settled return keeping its units */
import {
  address,
  createDb,
  customer,
  fulfillmentOrder,
  fulfillmentOrderLine,
  inventoryLevel,
  location,
  order,
  orderLine,
  outboxEvent,
  payment,
  product,
  returnRequestLine,
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
import { refundReturn, storeCreditCapPaise, suggestedRefundPaise } from './resolve'
import { recordRtoForShipment } from './rto'
import {
  approveReturn,
  arrangeReturnPickup,
  orderReturnState,
  receiveReturn,
  requestReturn,
  restockReturn,
} from './service'

const owner = createDb(process.env.DATABASE_URL_OWNER as string)
const app = createDb(process.env.DATABASE_URL as string)

beforeEach(async () => {
  await resetDb(owner)
})
afterAll(async () => {
  await owner.$client.end()
  await app.$client.end()
})

const inStore = <T>(storeId: string, fn: (ctx: StoreContext) => Promise<T>) =>
  withStore(app, storeId, (tx) => fn({ storeId, tx }))

/** A delivered, prepaid order of a ₹1,000 keyboard and a ₹500 mouse, one each. */
async function seed() {
  const [s] = await owner
    .insert(store)
    .values({
      slug: `w-${Math.random().toString(36).slice(2)}`,
      name: 'Waimers',
      shipping: {
        enabled: ['fake'],
        policy: {
          originPincode: '131028',
          warehouse: { name: 'HQ', line1: 'Plot 4', city: 'Sonipat', state: 'HR', phone: '9' },
        },
      },
    })
    .returning()
  if (!s) throw new Error('seed')
  const [cu] = await owner
    .insert(customer)
    .values({ storeId: s.id, email: 'asha@example.com', name: 'Asha' })
    .returning()
  const [a] = await owner
    .insert(address)
    .values({
      storeId: s.id,
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
    .values({ storeId: s.id, handle: 'kit', title: 'Kit', status: 'active' })
    .returning()
  const variants = await owner
    .insert(variant)
    .values([
      { storeId: s.id, productId: p?.id as string, title: 'Keyboard', pricePaise: 100000 },
      { storeId: s.id, productId: p?.id as string, title: 'Mouse', pricePaise: 50000 },
    ])
    .returning()
  const [kb, mouse] = variants
  if (!kb || !mouse) throw new Error('seed')
  await owner.insert(inventoryLevel).values([
    { storeId: s.id, variantId: kb.id, onHand: 5 },
    { storeId: s.id, variantId: mouse.id, onHand: 5 },
  ])
  const [o] = await owner
    .insert(order)
    .values({
      storeId: s.id,
      number: 1,
      status: 'open',
      customerId: cu?.id,
      subtotalPaise: 150000,
      totalPaise: 150000,
      paymentMethod: 'manual',
      email: 'asha@example.com',
      shippingAddressId: a?.id,
      deliveredAt: new Date(),
    })
    .returning()
  if (!o) throw new Error('seed')
  const lines = await owner
    .insert(orderLine)
    .values(
      [kb, mouse].map((v) => ({
        storeId: s.id,
        orderId: o.id,
        variantId: v.id,
        title: v.title,
        variantTitle: 'Default',
        quantity: 1,
        fulfilledQuantity: 1,
        unitPricePaise: v.pricePaise,
      })),
    )
    .returning()
  await owner.insert(payment).values({
    storeId: s.id,
    orderId: o.id,
    provider: 'manual',
    providerRef: `ref_${o.id}`,
    status: 'captured',
    amountPaise: 150000,
  })
  return {
    storeId: s.id,
    orderId: o.id,
    customerId: cu?.id as string,
    kb: { variantId: kb.id, lineId: lines[0]?.id as string },
    mouse: { variantId: mouse.id, lineId: lines[1]?.id as string },
  }
}

const onHand = async (variantId: string) =>
  (await owner.select().from(inventoryLevel).where(eq(inventoryLevel.variantId, variantId)))[0]
    ?.onHand

const approvals = (storeId: string) =>
  owner
    .select()
    .from(outboxEvent)
    .where(and(eq(outboxEvent.storeId, storeId), eq(outboxEvent.type, 'return.approved')))

const askToReturn = (s: Awaited<ReturnType<typeof seed>>, lineId: string) =>
  inStore(s.storeId, (ctx) =>
    requestReturn(ctx, {
      orderId: s.orderId,
      lines: [{ orderLineId: lineId, quantity: 1 }],
      reason: 'damaged',
      requestedBy: 'customer',
      customerId: s.customerId,
    }),
  )

describe('courier pickup and the approval message', () => {
  it('a courier booked after the approval went out tells the shopper again', async () => {
    const s = await seed()
    const r = await askToReturn(s, s.kb.lineId)
    await inStore(s.storeId, (ctx) => approveReturn(ctx, r.id))
    // The relay sent "approved, please send it back" before any courier was chosen.
    await owner.update(outboxEvent).set({ dispatchedAt: new Date() })
    await inStore(s.storeId, (ctx) => arrangeReturnPickup(ctx, r.id, new FakeShippingProvider()))
    expect(await approvals(s.storeId)).toHaveLength(2)
  })

  it('a courier booked with the approval sends one message', async () => {
    const s = await seed()
    const r = await askToReturn(s, s.kb.lineId)
    await inStore(s.storeId, async (ctx) => {
      await approveReturn(ctx, r.id)
      await arrangeReturnPickup(ctx, r.id, new FakeShippingProvider())
    })
    expect(await approvals(s.storeId)).toHaveLength(1)
  })
})

describe('RTO of one parcel', () => {
  it('covers only what that parcel carried, and suggests refunding that parcel', async () => {
    const s = await seed()
    const [loc] = await owner.select().from(location).where(eq(location.storeId, s.storeId))
    if (!loc) throw new Error('no default location')
    const parcels = await owner
      .insert(fulfillmentOrder)
      .values([
        { storeId: s.storeId, orderId: s.orderId, locationId: loc.id, position: 1 },
        { storeId: s.storeId, orderId: s.orderId, locationId: loc.id, position: 2 },
      ])
      .returning()
    await owner.insert(fulfillmentOrderLine).values([
      {
        storeId: s.storeId,
        fulfillmentOrderId: parcels[0]?.id as string,
        orderLineId: s.kb.lineId,
        quantity: 1,
        fulfilledQuantity: 1,
      },
      {
        storeId: s.storeId,
        fulfillmentOrderId: parcels[1]?.id as string,
        orderLineId: s.mouse.lineId,
        quantity: 1,
        fulfilledQuantity: 1,
      },
    ])
    const [back] = await owner
      .insert(shipment)
      .values({
        storeId: s.storeId,
        orderId: s.orderId,
        fulfillmentOrderId: parcels[1]?.id as string,
        provider: 'fake',
        waybill: 'RTO-2',
        status: 'rto',
      })
      .returning()
    if (!back) throw new Error('shipment')

    const task = await inStore(s.storeId, (ctx) => recordRtoForShipment(ctx, back))
    if (!task) throw new Error('no RTO task')
    const lines = await owner
      .select()
      .from(returnRequestLine)
      .where(eq(returnRequestLine.returnRequestId, task.id))
    expect(lines.map((l) => [l.orderLineId, l.quantity])).toEqual([[s.mouse.lineId, 1]])

    await inStore(s.storeId, (ctx) => restockReturn(ctx, task.id))
    expect(await onHand(s.mouse.variantId)).toBe(6)
    expect(await onHand(s.kb.variantId)).toBe(5)

    // The keyboard reached the shopper: only the mouse's ₹500 goes back by default.
    expect(await inStore(s.storeId, (ctx) => suggestedRefundPaise(ctx, task.id))).toBe(50000)
  })

  it('an RTO of the whole order still suggests everything paid', async () => {
    const s = await seed()
    const [back] = await owner
      .insert(shipment)
      .values({
        storeId: s.storeId,
        orderId: s.orderId,
        provider: 'fake',
        waybill: 'RTO-ALL',
        status: 'rto',
      })
      .returning()
    if (!back) throw new Error('shipment')
    const task = await inStore(s.storeId, (ctx) => recordRtoForShipment(ctx, back))
    if (!task) throw new Error('no RTO task')
    expect(await inStore(s.storeId, (ctx) => suggestedRefundPaise(ctx, task.id))).toBe(150000)
    expect(storeCreditCapPaise({ kind: 'rto', goodsPaise: 0, availablePaise: 150000 })).toBe(150000)
  })
})

describe('a settled return', () => {
  it('keeps its units: the same item can not be returned twice', async () => {
    const s = await seed()
    const r = await askToReturn(s, s.mouse.lineId)
    await inStore(s.storeId, (ctx) => approveReturn(ctx, r.id))
    await inStore(s.storeId, (ctx) => arrangeReturnPickup(ctx, r.id, null))
    await inStore(s.storeId, (ctx) => receiveReturn(ctx, r.id, { condition: 'good' }))
    expect(await onHand(s.mouse.variantId)).toBe(6)
    await inStore(s.storeId, (ctx) =>
      refundReturn(ctx, r.id, { amountPaise: 50000, providerFor: async () => null }),
    )
    await expect(askToReturn(s, s.mouse.lineId)).rejects.toThrow(/more than was delivered/)
    const state = await inStore(s.storeId, (ctx) => orderReturnState(ctx, s.orderId))
    expect(state?.eligibility.lines.map((l) => l.returnable)).toEqual(
      state?.lines.map((l) => (l.id === s.kb.lineId ? 1 : 0)),
    )
    const [o] = await owner.select().from(order).where(eq(order.id, s.orderId))
    expect(o?.paymentStatus).toBe('partially_refunded')
  })
})
