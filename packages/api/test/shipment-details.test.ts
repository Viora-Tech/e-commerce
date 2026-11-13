import { createMerchantAuth } from '@commerce/auth'
import {
  address,
  createDb,
  order,
  orderLine,
  orderNote,
  product,
  shipment,
  store,
  variant,
} from '@commerce/db'
import { resetDb } from '@commerce/db/test'
import { call } from '@orpc/server'
import { eq } from 'drizzle-orm'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import type { ApiContext } from '../src/context'
import { appRouter } from '../src/routers/_app'

/**
 * A booked shipment's details view, its cancel and the rebooking it frees, end to end through
 * the routers on the demo courier (`fake`): no courier API is ever called.
 */

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
    .values({
      slug,
      name: slug,
      organizationId: org?.id as string,
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
  return {
    ctx: { db: app, auth, headers, notifications: { add: async () => undefined } } as ApiContext,
    storeId: s?.id as string,
  }
}

/** A COD order of two units, nothing packed yet. */
async function seedCodOrder(storeId: string, variantWeightGrams?: number) {
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
  const [o] = await owner
    .insert(order)
    .values({
      storeId,
      number: 7,
      status: 'open',
      subtotalPaise: 199900,
      totalPaise: 199900,
      paymentMethod: 'cod',
      shippingAddressId: a?.id as string,
    })
    .returning()
  const [p] = await owner
    .insert(product)
    .values({ storeId, handle: 'pad', title: 'Pad', status: 'active' })
    .returning()
  const [v] = await owner
    .insert(variant)
    .values({
      storeId,
      productId: p?.id as string,
      title: 'Default',
      pricePaise: 99950,
      weightGrams: variantWeightGrams ?? null,
    })
    .returning()
  await owner.insert(orderLine).values({
    storeId,
    orderId: o?.id as string,
    variantId: v?.id as string,
    title: 'Pad',
    variantTitle: 'Default',
    quantity: 2,
    unitPricePaise: 99950,
  })
  return o?.id as string
}

beforeEach(async () => {
  await resetDb(owner)
  sent.length = 0
})
afterAll(async () => {
  await owner.$client.end()
  await app.$client.end()
})

describe('shipment details, cancel and rebooking', () => {
  it('shows the booking, cancels it with a timeline entry, then offers the parcel again', async () => {
    const m = await merchant('details@example.com', 'details')
    const orderId = await seedCodOrder(m.storeId)
    const booked = await call(
      appRouter.orders.createShipment,
      {
        orderId,
        providerId: 'fake',
        serviceLabel: 'Surface',
        paymentMode: 'cod',
        codAmountPaise: 150000,
      },
      { context: m.ctx },
    )

    const details = await call(appRouter.shipments.get, { id: booked.id }, { context: m.ctx })
    expect(details).toMatchObject({
      waybill: booked.waybill,
      status: 'created',
      paymentMode: 'cod',
      codAmountPaise: 150000,
      serviceLabel: 'Surface',
      pickupLocationName: 'Waimers HQ',
      cancelBlock: null,
    })
    expect(details.providerLabel).not.toBe('')

    // The order page reads the same view.
    const o = await call(appRouter.orders.get, { id: orderId }, { context: m.ctx })
    expect(o?.shipment?.cancelBlock).toBeNull()

    await call(appRouter.orders.cancelShipment, { shipmentId: booked.id }, { context: m.ctx })
    const after = await call(appRouter.shipments.get, { id: booked.id }, { context: m.ctx })
    expect(after.status).toBe('cancelled')
    expect(after.cancelBlock).toBe('cancelled')
    const notes = await owner.select().from(orderNote).where(eq(orderNote.orderId, orderId))
    expect(notes[0]?.author).toBe('details@example.com')
    expect(notes[0]?.body).toContain(booked.waybill)

    // A second cancel is refused with the reason, not sent to the courier.
    await expect(
      call(appRouter.orders.cancelShipment, { shipmentId: booked.id }, { context: m.ctx }),
    ).rejects.toMatchObject({ code: 'PRECONDITION_FAILED', data: { block: 'cancelled' } })

    // The packed parcel books again with its two units.
    const draft = await call(
      appRouter.shipments.prepare,
      { orderIds: [orderId] },
      { context: m.ctx },
    )
    expect(draft.orders[0]?.blocked).toBeNull()
    expect(draft.orders[0]?.parcels[0]?.lines.map((l) => l.quantity)).toEqual([2])
    const again = await call(
      appRouter.orders.createShipment,
      {
        orderId,
        providerId: 'fake',
        fulfillmentOrderId: draft.orders[0]?.parcels[0]?.id ?? undefined,
      },
      { context: m.ctx },
    )
    expect(again.id).not.toBe(booked.id)
    expect(again.status).toBe('created')
  })

  it('refuses a cancel once the courier collected the parcel', async () => {
    const m = await merchant('picked@example.com', 'picked')
    const orderId = await seedCodOrder(m.storeId)
    const booked = await call(
      appRouter.orders.createShipment,
      { orderId, providerId: 'fake' },
      { context: m.ctx },
    )
    await owner.update(shipment).set({ status: 'in_transit' }).where(eq(shipment.id, booked.id))
    const details = await call(appRouter.shipments.get, { id: booked.id }, { context: m.ctx })
    expect(details.cancelBlock).toBe('picked_up')
    await expect(
      call(appRouter.orders.cancelShipment, { shipmentId: booked.id }, { context: m.ctx }),
    ).rejects.toMatchObject({ code: 'PRECONDITION_FAILED', data: { block: 'picked_up' } })
  })

  it('serves an old Delhivery packing slip link through the admin route', async () => {
    const m = await merchant('label@example.com', 'label')
    const orderId = await seedCodOrder(m.storeId)
    const [row] = await owner
      .insert(shipment)
      .values({
        storeId: m.storeId,
        orderId,
        provider: 'delhivery',
        waybill: 'DL123',
        labelUrl: 'https://track.delhivery.com/api/p/packing_slip?wbns=DL123&pdf=true',
      })
      .returning()
    const details = await call(
      appRouter.shipments.get,
      { id: row?.id as string },
      { context: m.ctx },
    )
    expect(details.labelUrl).toBe(`/api/shipments/${row?.id}/label`)
    const list = await call(appRouter.shipments.list, { page: 1, perPage: 10 }, { context: m.ctx })
    expect(list.items[0]?.labelUrl).toBe(`/api/shipments/${row?.id}/label`)
    // Delhivery is not connected on this store: there is no label to fetch, and no courier call.
    await expect(
      call(appRouter.shipments.label, { id: row?.id as string }, { context: m.ctx }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' })
  })
})

describe('bulk Create shipment: step 2 quote', () => {
  it('quotes a parcel whose products weigh 0 g, as the bulk dialog sends it (no 400)', async () => {
    const m = await merchant('q@example.com', 'store-q')
    // Shopify imports save "no weight" as 0 g.
    const orderId = await seedCodOrder(m.storeId, 0)
    const draft = await call(
      appRouter.shipments.prepare,
      { orderIds: [orderId] },
      { context: m.ctx },
    )
    const o = draft.orders[0]
    const parcel = o?.parcels[0]
    expect(parcel?.weightGrams).toBeGreaterThanOrEqual(1)
    // Step 1's values straight into step 2, the way the bulk flow maps them.
    const quotes = await call(
      appRouter.shipments.quote,
      {
        parcels: [
          {
            orderId,
            fulfillmentOrderId: parcel?.id,
            pickupLocationId: parcel?.pickupLocationId,
            weightGrams: parcel?.weightGrams,
            dimensionsCm: parcel?.dimensionsCm ?? undefined,
            paymentMode: o?.paymentMode,
            declaredValuePaise: parcel?.valuePaise,
          },
        ],
      },
      { context: m.ctx },
    )
    expect(quotes.map((q) => q.orderId)).toEqual([orderId])
  })
})

describe('shipments.schedulePickup input', () => {
  it('refuses a start time that is not hh:mm before any courier is asked', async () => {
    const m = await merchant('pickup-time@example.com', 'pickup-time')
    // Typed in the Pickups tab's free-text box: Delhivery wants hh:mm:ss, so "2 pm" never books.
    await expect(
      call(
        appRouter.shipments.schedulePickup,
        { shipmentIds: [crypto.randomUUID()], date: '2099-01-01', timeFrom: '2 pm' },
        { context: m.ctx },
      ),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' })
  })
})
