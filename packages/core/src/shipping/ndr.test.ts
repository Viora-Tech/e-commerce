/** SOURCE OF TRUTH: NDR auto-detection tests — per-courier detection, clearing, idempotency, RLS */
import {
  address,
  createDb,
  order,
  orderLine,
  outboxEvent,
  product,
  shipment,
  store,
  variant,
  withStore,
} from '@commerce/db'
import { resetDb } from '@commerce/db/test'
import { FakeShippingProvider, type Tracking } from '@commerce/shipping'
import { and, eq } from 'drizzle-orm'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { applyTracking, createShipmentForOrder } from './shipments'

const owner = createDb(process.env.DATABASE_URL_OWNER as string)
const app = createDb(process.env.DATABASE_URL as string)

beforeEach(async () => {
  await resetDb(owner)
})
afterAll(async () => {
  await owner.$client.end()
  await app.$client.end()
})

let orderNumber = 0

async function seedOrder() {
  orderNumber += 1
  const [s] = await owner
    .insert(store)
    .values({
      slug: `w-${Math.random().toString(36).slice(2)}`,
      name: 'Waimers',
      shipping: {
        enabled: ['fake'],
        policy: {
          originPincode: '131028',
          warehouse: {
            name: 'Waimers HQ',
            line1: 'Plot 4',
            city: 'Sonipat',
            state: 'HR',
            phone: '9',
          },
        },
      },
    })
    .returning()
  if (!s) throw new Error('seed')
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
  const [o] = await owner
    .insert(order)
    .values({
      storeId: s.id,
      number: orderNumber,
      status: 'open',
      subtotalPaise: 199900,
      totalPaise: 199900,
      paymentMethod: 'cod',
      email: 'asha@example.com',
      shippingAddressId: a?.id,
    })
    .returning()
  if (!o) throw new Error('seed')
  const [p] = await owner
    .insert(product)
    .values({ storeId: s.id, handle: 'p', title: 'Pad', status: 'active' })
    .returning()
  const [v] = await owner
    .insert(variant)
    .values({ storeId: s.id, productId: p?.id as string, title: 'Default', pricePaise: 199900 })
    .returning()
  await owner.insert(orderLine).values({
    storeId: s.id,
    orderId: o.id,
    variantId: v?.id as string,
    title: 'Pad',
    variantTitle: 'Default',
    quantity: 1,
    unitPricePaise: 199900,
  })
  return { storeId: s.id, orderId: o.id }
}

async function seedShipment() {
  const { storeId, orderId } = await seedOrder()
  const row = await withStore(app, storeId, (tx) =>
    createShipmentForOrder({ storeId, tx }, new FakeShippingProvider(), orderId),
  )
  return { storeId, orderId, row }
}

const shipmentOf = async (id: string) =>
  (await owner.select().from(shipment).where(eq(shipment.id, id)))[0]

const ndrOutboxOf = (storeId: string, type: 'shipment.ndr_raised' | 'shipment.ndr_resolved') =>
  owner
    .select()
    .from(outboxEvent)
    .where(and(eq(outboxEvent.storeId, storeId), eq(outboxEvent.type, type)))

// A representative Delhivery scan: StatusType 'UD' (undelivered) is mapped to
// `in_transit` by `mapDelhiveryStatus` (packages/shipping-delhivery), so the
// NDR signal has to come from the free-text Instructions the connector
// copies into `description` - see ndr.ts's own comment on why there is no
// fixed status code to switch on instead.
const delhiveryNdrTracking = (waybill: string): Tracking => ({
  waybill,
  status: 'in_transit',
  events: [
    { at: '2026-09-20T10:00:00.000Z', status: 'in_transit', description: 'In transit' },
    {
      at: '2026-09-21T09:00:00.000Z',
      status: 'in_transit',
      description: 'Consignee Not Available - address incorrect',
    },
  ],
})

// A representative Shiprocket scan: `current_status`/activity text is free
// text too (Shiprocket's own support docs just say "Undelivered").
const shiprocketNdrTracking = (waybill: string): Tracking => ({
  waybill,
  status: 'in_transit',
  events: [
    { at: '2026-09-20T10:00:00.000Z', status: 'in_transit', description: 'In Transit' },
    {
      at: '2026-09-21T09:00:00.000Z',
      status: 'in_transit',
      description: 'Undelivered - Customer refused to accept',
    },
  ],
})

describe('syncNdrFromTracking via applyTracking', () => {
  it('never opens an NDR once the courier reports delivered, even if the last scan text mentions a failed attempt', async () => {
    const { storeId, row } = await seedShipment()
    const deliveredAfterAttempt: Tracking = {
      waybill: row.waybill,
      status: 'delivered',
      events: [
        {
          at: '2026-09-22T00:00:00.000Z',
          status: 'delivered',
          description: 'Undelivered attempt then delivered on retry',
        },
      ],
    }
    const result = await withStore(app, storeId, (tx) =>
      applyTracking({ storeId, tx }, row.id, deliveredAfterAttempt),
    )
    expect(result.shipment.ndrStatus).toBe('none')
  })

  it('ignores ordinary in-flight scans with no NDR wording', async () => {
    const { storeId, row } = await seedShipment()
    const outForDelivery: Tracking = {
      waybill: row.waybill,
      status: 'out_for_delivery',
      events: [
        {
          at: '2026-09-22T00:00:00.000Z',
          status: 'out_for_delivery',
          description: 'Out for delivery',
        },
      ],
    }
    const result = await withStore(app, storeId, (tx) =>
      applyTracking({ storeId, tx }, row.id, outForDelivery),
    )
    expect(result.shipment.ndrStatus).toBe('none')
  })

  it('raises an NDR from a Delhivery-style scan', async () => {
    const { storeId, row } = await seedShipment()
    const result = await withStore(app, storeId, (tx) =>
      applyTracking({ storeId, tx }, row.id, delhiveryNdrTracking(row.waybill)),
    )
    expect(result.shipment.ndrStatus).toBe('pending')
    expect(result.shipment.ndrReason).toBe('Consignee Not Available - address incorrect')
    const raised = await ndrOutboxOf(storeId, 'shipment.ndr_raised')
    expect(raised).toHaveLength(1)
  })

  it('raises an NDR from a Shiprocket-style scan', async () => {
    const { storeId, row } = await seedShipment()
    const result = await withStore(app, storeId, (tx) =>
      applyTracking({ storeId, tx }, row.id, shiprocketNdrTracking(row.waybill)),
    )
    expect(result.shipment.ndrStatus).toBe('pending')
    expect(result.shipment.ndrReason).toBe('Undelivered - Customer refused to accept')
  })

  it('is idempotent: re-applying the same scan does not re-raise or double-emit', async () => {
    const { storeId, row } = await seedShipment()
    const tracking = delhiveryNdrTracking(row.waybill)
    const first = await withStore(app, storeId, (tx) =>
      applyTracking({ storeId, tx }, row.id, tracking),
    )
    const firstRaisedAt = (await shipmentOf(row.id))?.ndrRaisedAt
    const second = await withStore(app, storeId, (tx) =>
      applyTracking({ storeId, tx }, row.id, tracking),
    )
    expect(second.shipment.ndrStatus).toBe('pending')
    expect((await shipmentOf(row.id))?.ndrRaisedAt).toEqual(firstRaisedAt)
    expect(first.shipment.ndrReason).toBe(second.shipment.ndrReason)
    const raised = await ndrOutboxOf(storeId, 'shipment.ndr_raised')
    expect(raised).toHaveLength(1)
  })

  it('clears the NDR once a later scan shows delivered', async () => {
    const { storeId, row } = await seedShipment()
    await withStore(app, storeId, (tx) =>
      applyTracking({ storeId, tx }, row.id, delhiveryNdrTracking(row.waybill)),
    )
    const delivered: Tracking = {
      waybill: row.waybill,
      status: 'delivered',
      events: [{ at: '2026-09-23T00:00:00.000Z', status: 'delivered', description: 'Delivered' }],
    }
    const result = await withStore(app, storeId, (tx) =>
      applyTracking({ storeId, tx }, row.id, delivered),
    )
    expect(result.shipment.ndrStatus).toBe('resolved')
    const resolved = await ndrOutboxOf(storeId, 'shipment.ndr_resolved')
    expect(resolved).toHaveLength(1)
  })

  it('clears the NDR once a later scan shows RTO', async () => {
    const { storeId, row } = await seedShipment()
    await withStore(app, storeId, (tx) =>
      applyTracking({ storeId, tx }, row.id, shiprocketNdrTracking(row.waybill)),
    )
    const rto: Tracking = {
      waybill: row.waybill,
      status: 'rto',
      events: [{ at: '2026-09-23T00:00:00.000Z', status: 'rto', description: 'RTO Initiated' }],
    }
    const result = await withStore(app, storeId, (tx) =>
      applyTracking({ storeId, tx }, row.id, rto),
    )
    expect(result.shipment.ndrStatus).toBe('resolved')
  })

  it('resolving is idempotent: a second delivered scan does not double-emit', async () => {
    const { storeId, row } = await seedShipment()
    await withStore(app, storeId, (tx) =>
      applyTracking({ storeId, tx }, row.id, delhiveryNdrTracking(row.waybill)),
    )
    const delivered: Tracking = {
      waybill: row.waybill,
      status: 'delivered',
      events: [{ at: '2026-09-23T00:00:00.000Z', status: 'delivered', description: 'Delivered' }],
    }
    await withStore(app, storeId, (tx) => applyTracking({ storeId, tx }, row.id, delivered))
    await withStore(app, storeId, (tx) => applyTracking({ storeId, tx }, row.id, delivered))
    const resolved = await ndrOutboxOf(storeId, 'shipment.ndr_resolved')
    expect(resolved).toHaveLength(1)
  })

  it('never raises an NDR for a shipment tracked cleanly to delivery', async () => {
    const { storeId, row } = await seedShipment()
    const delivered: Tracking = {
      waybill: row.waybill,
      status: 'delivered',
      events: [{ at: '2026-09-23T00:00:00.000Z', status: 'delivered', description: 'Delivered' }],
    }
    const result = await withStore(app, storeId, (tx) =>
      applyTracking({ storeId, tx }, row.id, delivered),
    )
    expect(result.shipment.ndrStatus).toBe('none')
    expect(await ndrOutboxOf(storeId, 'shipment.ndr_raised')).toHaveLength(0)
    expect(await ndrOutboxOf(storeId, 'shipment.ndr_resolved')).toHaveLength(0)
  })

  it('does not touch a shipment in another store (RLS)', async () => {
    const { storeId: storeA, row: rowA } = await seedShipment()
    const { storeId: storeB, row: rowB } = await seedShipment()
    await withStore(app, storeA, (tx) =>
      applyTracking({ storeId: storeA, tx }, rowA.id, delhiveryNdrTracking(rowA.waybill)),
    )
    const other = await shipmentOf(rowB.id)
    expect(other?.ndrStatus).toBe('none')
    expect(other?.storeId).toBe(storeB)
    // RLS also refuses a cross-store id even if guessed - the (store, waybill)
    // scoping in `syncNdrFromTracking`/`raiseNdr` never touches another store's row.
    await expect(
      withStore(app, storeB, (tx) =>
        applyTracking({ storeId: storeB, tx }, rowA.id, delhiveryNdrTracking(rowA.waybill)),
      ),
    ).rejects.toThrow('shipment not found')
  })
})
