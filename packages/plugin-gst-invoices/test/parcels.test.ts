import { addRegistration } from '@commerce/core/gst-registration-service'
import { gstinCheckChar } from '@commerce/core/gstin'
import {
  address,
  createDb,
  fulfillmentOrder,
  fulfillmentOrderLine,
  gstRegistration,
  location,
  order,
  orderLine,
  payment,
  product,
  refund,
  type StoreTx,
  store,
  variant,
  withStore,
} from '@commerce/db'
import { resetDb } from '@commerce/db/test'
import { DocumentSnapshotSchema } from '@commerce/invoices'
import { asc, eq } from 'drizzle-orm'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { InvoiceError, issueCreditNote } from '../src/issue'
import { enqueueOrder, enqueueOrderParcels, issueDrafts } from '../src/queue'
import { invoice } from '../src/schema'

/*
 * An order shipped from two warehouses is two supplies from two GSTINs: one tax invoice per
 * parcel, each in its own GSTIN's series, together adding up to what the shopper paid.
 */

const owner = createDb(process.env.DATABASE_URL_OWNER as string)
const app = createDb(process.env.DATABASE_URL as string)
const at = new Date('2025-06-02T06:00:00Z')

afterAll(async () => {
  await owner.$client.end()
  await app.$client.end()
})

beforeEach(async () => {
  await resetDb(owner)
})

function gstin(state: string, pan = 'AAPFU0939F'): string {
  const first14 = `${state}${pan}1Z`
  return first14 + gstinCheckChar(first14)
}
const HR = gstin('06')
const KA = gstin('29')

const inStore = <T>(storeId: string, fn: (tx: StoreTx) => Promise<T>) => withStore(app, storeId, fn)

type Parcel = {
  locationId: string
  registrationId: string
  /** [line index, quantity] */
  units: [number, number][]
  money: {
    subtotal: number
    shipping: number
    total: number
    tax: { taxPaise: number; cgstPaise: number; sgstPaise: number; igstPaise: number }
  } | null
}

/**
 * Waimers with Haryana (default) and Karnataka GSTINs and a warehouse under each, and a paid
 * order to Mumbai for a kurta (₹1,000, 12%) and a cap (₹500, 12%) plus ₹100 shipping.
 */
async function seed() {
  const [s] = await owner
    .insert(store)
    .values({
      slug: 'waimers',
      name: 'Waimers',
      address: { line1: '14 Sector 29', city: 'Gurugram', state: 'HR', pincode: '122001' },
    })
    .returning()
  const storeId = s?.id as string
  const hr = await inStore(storeId, (tx) => addRegistration(tx, storeId, { gstin: HR }))
  const ka = await inStore(storeId, (tx) =>
    addRegistration(tx, storeId, {
      gstin: KA,
      invoicePrefix: 'BLR',
      legalAddress: { line1: '5 Whitefield Road', city: 'Bengaluru', pincode: '560066' },
    }),
  )
  const [gurugram, bengaluru] = await owner
    .insert(location)
    .values([
      {
        storeId,
        name: 'Gurugram',
        stateCode: 'HR',
        isDefault: true,
        fulfilsOnlineOrders: true,
        gstRegistrationId: hr.id,
      },
      {
        storeId,
        name: 'Bengaluru',
        stateCode: 'KA',
        fulfilsOnlineOrders: true,
        gstRegistrationId: ka.id,
      },
    ])
    .returning()
  const [p] = await owner
    .insert(product)
    .values({ storeId, handle: 'kurta', title: 'Kurta' })
    .returning()
  const [kurta, cap] = await owner
    .insert(variant)
    .values([
      { storeId, productId: p?.id as string, title: 'M', sku: 'KRT-M', pricePaise: 100_000 },
      { storeId, productId: p?.id as string, title: 'Cap', sku: 'CAP', pricePaise: 50_000 },
    ])
    .returning()
  const [a] = await owner
    .insert(address)
    .values({
      storeId,
      name: 'Aarav Mehta',
      line1: 'Carter Road',
      city: 'Mumbai',
      stateCode: 'MH',
      pincode: '400050',
      phone: '9820012345',
    })
    .returning()
  const [o] = await owner
    .insert(order)
    .values({
      storeId,
      number: 1,
      status: 'open',
      paymentStatus: 'paid',
      checkoutPaidAt: at,
      paymentMethod: 'razorpay',
      shippingAddressId: a?.id,
      subtotalPaise: 150_000,
      shippingPaise: 10_000,
      totalPaise: 160_000,
      gstRegistrationId: hr.id,
      taxBreakdown: {
        taxPaise: 17_143,
        cgstPaise: 0,
        sgstPaise: 0,
        igstPaise: 17_143,
        ratePercent: 12,
        interState: true,
        byRate: [],
      },
    })
    .returning()
  const lines = await owner
    .insert(orderLine)
    .values([
      {
        storeId,
        orderId: o?.id as string,
        variantId: kurta?.id as string,
        title: 'Kurta',
        variantTitle: 'M',
        quantity: 1,
        unitPricePaise: 100_000,
        gstRatePercent: 12,
        hsCode: '620520',
      },
      {
        storeId,
        orderId: o?.id as string,
        variantId: cap?.id as string,
        title: 'Cap',
        variantTitle: 'Default',
        quantity: 1,
        unitPricePaise: 50_000,
        gstRatePercent: 12,
        hsCode: '650500',
      },
    ])
    .returning()
  return {
    storeId,
    orderId: o?.id as string,
    hr: hr.id,
    ka: ka.id,
    gurugram: gurugram?.id as string,
    bengaluru: bengaluru?.id as string,
    lineIds: lines.map((l) => l.id),
  }
}

type Seeded = Awaited<ReturnType<typeof seed>>

async function addParcels(t: Seeded, parcels: Parcel[]) {
  for (const [i, p] of parcels.entries()) {
    const [fo] = await owner
      .insert(fulfillmentOrder)
      .values({
        storeId: t.storeId,
        orderId: t.orderId,
        locationId: p.locationId,
        gstRegistrationId: p.registrationId,
        position: i + 1,
        ...(p.money
          ? {
              subtotalPaise: p.money.subtotal,
              discountPaise: 0,
              adjustmentPaise: 0,
              shippingPaise: p.money.shipping,
              totalPaise: p.money.total,
              taxPaise: p.money.tax.taxPaise,
              taxBreakdown: { ...p.money.tax, ratePercent: 12, interState: true, byRate: [] },
            }
          : {}),
      })
      .returning()
    await owner.insert(fulfillmentOrderLine).values(
      p.units.map(([line, quantity]) => ({
        storeId: t.storeId,
        fulfillmentOrderId: fo?.id as string,
        orderLineId: t.lineIds[line] as string,
        quantity,
      })),
    )
  }
}

/** Kurta from Gurugram (HR), cap from Bengaluru (KA), shipping shared by value. */
const split = (t: Seeded): Parcel[] => [
  {
    locationId: t.gurugram,
    registrationId: t.hr,
    units: [[0, 1]],
    money: {
      subtotal: 100_000,
      shipping: 6_667,
      total: 106_667,
      tax: { taxPaise: 11_429, cgstPaise: 0, sgstPaise: 0, igstPaise: 11_429 },
    },
  },
  {
    locationId: t.bengaluru,
    registrationId: t.ka,
    units: [[1, 1]],
    money: {
      subtotal: 50_000,
      shipping: 3_333,
      total: 53_333,
      tax: { taxPaise: 5_714, cgstPaise: 0, sgstPaise: 0, igstPaise: 5_714 },
    },
  },
]

async function invoicesOf(orderId: string) {
  return owner
    .select()
    .from(invoice)
    .where(eq(invoice.orderId, orderId))
    .orderBy(asc(invoice.createdAt), asc(invoice.id))
}

describe('one tax invoice per parcel', () => {
  it('queues a draft per parcel under its GSTIN, adding up to the order', async () => {
    const t = await seed()
    await addParcels(t, split(t))
    const queued = await inStore(t.storeId, (tx) =>
      enqueueOrderParcels(tx, t.storeId, t.orderId, 'manual', at),
    )
    expect(queued.map((q) => q.created)).toEqual([true, true])
    const rows = await invoicesOf(t.orderId)
    expect(rows.map((r) => r.gstRegistrationId)).toEqual([t.hr, t.ka])
    expect(rows.map((r) => r.totalPaise)).toEqual([106_667, 53_333])
    expect(rows.reduce((n, r) => n + r.totalPaise, 0)).toBe(160_000)
    expect(rows.map((r) => r.igstPaise)).toEqual([11_429, 5_714])
    const [hrDoc, kaDoc] = rows.map((r) => DocumentSnapshotSchema.parse(r.snapshot))
    expect(hrDoc?.seller.gstin).toBe(HR)
    expect(kaDoc?.seller.gstin).toBe(KA)
    // Each prints only its own goods (and its share of shipping).
    expect(hrDoc?.lines.filter((l) => !l.charge).map((l) => l.description)).toEqual(['Kurta / M'])
    expect(kaDoc?.lines.filter((l) => !l.charge).map((l) => l.description)).toEqual(['Cap'])
    expect(kaDoc?.lines.find((l) => l.charge)?.totalPaise).toBe(3_333)
  })

  it('is idempotent per parcel', async () => {
    const t = await seed()
    await addParcels(t, split(t))
    await inStore(t.storeId, (tx) => enqueueOrderParcels(tx, t.storeId, t.orderId, 'manual', at))
    const again = await inStore(t.storeId, (tx) =>
      enqueueOrderParcels(tx, t.storeId, t.orderId, 'manual', at),
    )
    expect(again.map((q) => q.created)).toEqual([false, false])
    expect(await invoicesOf(t.orderId)).toHaveLength(2)
  })

  it('numbers each parcel in its own GSTIN series', async () => {
    const t = await seed()
    await addParcels(t, split(t))
    const queued = await inStore(t.storeId, (tx) =>
      enqueueOrderParcels(tx, t.storeId, t.orderId, 'manual', at),
    )
    await inStore(t.storeId, (tx) =>
      issueDrafts(
        tx,
        t.storeId,
        queued.map((q) => ({ id: q.row.id, invoiceDate: at })),
        { commit: true, now: at },
      ),
    )
    const rows = await invoicesOf(t.orderId)
    expect(rows.map((r) => [r.status, r.number, r.gstRegistrationId])).toEqual([
      ['issued', 'INV/25-26/0001', t.hr],
      ['issued', 'INV/25-26/0001', t.ka],
    ])
    // The parcel each bills stays on the row.
    const parcels = await owner
      .select()
      .from(fulfillmentOrder)
      .orderBy(asc(fulfillmentOrder.position))
    expect(rows.map((r) => r.fulfillmentOrderId)).toEqual(parcels.map((p) => p.id))
  })

  it('a parcel without stored figures takes the order’s shipping by goods value', async () => {
    const t = await seed()
    await addParcels(
      t,
      split(t).map((p) => ({ ...p, money: null })),
    )
    await inStore(t.storeId, (tx) => enqueueOrderParcels(tx, t.storeId, t.orderId, 'manual', at))
    const rows = await invoicesOf(t.orderId)
    expect(rows.map((r) => r.totalPaise)).toEqual([106_667, 53_333])
    // Worked out from each parcel's GSTIN: both inter-state to Maharashtra.
    expect(rows.every((r) => r.cgstPaise === 0 && r.igstPaise > 0)).toBe(true)
  })

  it('a parcel under a composition GSTIN is a bill of supply with no GST', async () => {
    const t = await seed()
    await owner
      .update(gstRegistration)
      .set({ registrationType: 'composition' })
      .where(eq(gstRegistration.id, t.ka))
    await addParcels(
      t,
      split(t).map((p) => ({ ...p, money: null })),
    )
    await inStore(t.storeId, (tx) => enqueueOrderParcels(tx, t.storeId, t.orderId, 'manual', at))
    const [, kaRow] = await invoicesOf(t.orderId)
    const kaDoc = DocumentSnapshotSchema.parse(kaRow?.snapshot)
    expect(kaDoc.composition).toBe(true)
    expect(kaRow?.igstPaise).toBe(0)
    expect(kaRow?.totalPaise).toBe(53_333)
  })

  it('a one-parcel order keeps one invoice, as before', async () => {
    const t = await seed()
    await addParcels(t, [
      {
        locationId: t.gurugram,
        registrationId: t.hr,
        units: [
          [0, 1],
          [1, 1],
        ],
        money: null,
      },
    ])
    const q = await inStore(t.storeId, (tx) => enqueueOrder(tx, t.storeId, t.orderId, 'manual', at))
    expect(q?.row.totalPaise).toBe(160_000)
    // The order's recorded split applies as it is.
    expect(q?.row.igstPaise).toBe(17_143)
    expect(await invoicesOf(t.orderId)).toHaveLength(1)
  })

  it('a refund on a split order does not guess a GSTIN for its credit note', async () => {
    const t = await seed()
    await addParcels(t, split(t))
    const queued = await inStore(t.storeId, (tx) =>
      enqueueOrderParcels(tx, t.storeId, t.orderId, 'manual', at),
    )
    await inStore(t.storeId, (tx) =>
      issueDrafts(
        tx,
        t.storeId,
        queued.map((q) => ({ id: q.row.id, invoiceDate: at })),
        { commit: true, now: at },
      ),
    )
    const [pay] = await owner
      .insert(payment)
      .values({
        storeId: t.storeId,
        orderId: t.orderId,
        provider: 'razorpay',
        providerRef: 'pay_1',
        status: 'captured',
        amountPaise: 160_000,
      })
      .returning()
    const [r] = await owner
      .insert(refund)
      .values({
        storeId: t.storeId,
        orderId: t.orderId,
        paymentId: pay?.id as string,
        amountPaise: 10_000,
        status: 'processed',
      })
      .returning()
    await expect(
      inStore(t.storeId, (tx) => issueCreditNote(tx, t.storeId, r?.id as string, { at })),
    ).rejects.toBeInstanceOf(InvoiceError)
  })
})
